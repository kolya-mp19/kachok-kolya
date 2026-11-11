import type { Json, OperationConfirmation } from '../../../../../contracts/operation-protocol';
import { DraftError } from './draft.error';
import { isRecord } from './draft-parser';
import type { EncryptedDraftStorage } from './encrypted-draft-storage';
import type {
    DraftSessionContext,
    EditorState,
    EditorStatus,
    OperationTransport,
    PrepareCommandParams,
    PreparedOperation,
} from './drafts.type';

const FINAL_REJECTION_CODES = new Set([
    'RECOVERY_GENERATION_MISMATCH',
    'REVISION_CONFLICT',
    'OPERATION_ID_CONFLICT',
    'INVALID_OPERATION',
    'OPERATION_REJECTED',
    'OWNER_MISMATCH',
]);

function lockedState(): EditorState {
    return { fields: null, baseRevision: '', localRevision: 0, status: 'locked' };
}

export class DraftEditor {
    private saveQueue: Promise<void> = Promise.resolve();
    private desiredStatus: EditorStatus;
    private saveVersion = 0;
    private requestInFlight = false;

    constructor(
        private readonly draftId: string,
        private readonly session: DraftSessionContext,
        private readonly epoch: number,
        private readonly storage: EncryptedDraftStorage,
        private state: EditorState,
        private storageRevision: number,
    ) {
        this.desiredStatus = state.status;
    }

    /** Возвращает копию; после блокировки даже прежний handle не раскрывает поля. */
    snapshot(): EditorState {
        return this.session.isActive(this.epoch) ? structuredClone(this.state) : lockedState();
    }

    async edit(fields: Json): Promise<void> {
        this.assertActive();
        this.state = {
            ...this.state,
            fields: structuredClone(fields),
            localRevision: this.state.localRevision + 1,
        };

        if (!this.state.pending) {
            this.state.status = 'draft';
        }

        await this.persist();
    }

    /** Фиксирует отдельную команду: дальнейший ввод не меняет её payload или UUID. */
    async prepare(params: PrepareCommandParams): Promise<void> {
        this.assertActive();

        if (this.state.pending) {
            throw new DraftError('PENDING_OPERATION');
        }

        this.state.pending = {
            command: {
                ...structuredClone(params),
                protocolVersion: 1,
                athleteId: this.session.athleteId,
                recoveryGeneration: this.session.recoveryGeneration,
                operationId: crypto.randomUUID(),
                baseRevision: this.state.baseRevision,
            },
            localRevision: this.state.localRevision,
        };
        this.state.status = 'ready';

        await this.persist();
    }

    /**
     * Сеть начинается только после commit локального состояния sending.
     * Неизвестный исход оставляет ту же команду для ручного повтора.
     */
    async send(transport: OperationTransport): Promise<void> {
        this.assertActive();

        if (!this.state.pending || this.requestInFlight) {
            throw new DraftError('PENDING_OPERATION');
        }

        this.requestInFlight = true;

        try {
            const pending = structuredClone(this.state.pending);
            this.state.status = 'sending';
            await this.persist();

            if (!this.session.isActive(this.epoch)) {
                return;
            }

            let confirmation: OperationConfirmation;

            try {
                confirmation = await transport(structuredClone(pending.command));
            } catch (error: unknown) {
                await this.handleTransportFailure(error);
                return;
            }

            // Возврат сети может произойти после выхода и нового входа. Такой ответ
            // не относится к действующей сессии, даже если атлет снова тот же.
            if (!this.session.isActive(this.epoch)) {
                return;
            }

            await this.acceptConfirmation(pending, confirmation);
        } finally {
            this.requestInFlight = false;
        }
    }

    async retry(transport: OperationTransport): Promise<void> {
        await this.send(transport);
    }

    async retryLocal(): Promise<void> {
        this.assertActive();
        this.state.status = this.state.pending ? 'unknown' : 'draft';
        await this.persist();
    }

    /** Неизвестную отправку нельзя заменить новой командой без определённого отказа. */
    async reconcile(baseRevision: string): Promise<void> {
        this.assertActive();

        if (this.state.pending && this.state.status !== 'conflict') {
            throw new DraftError('PENDING_OPERATION');
        }

        this.state.pending = undefined;
        this.state.baseRevision = baseRevision;
        this.state.status = 'draft';
        await this.persist();
    }

    /** Передаётся актуальное серверное чтение, которое историческая квитанция не должна затереть. */
    async observeConfirmed(confirmed: Pick<OperationConfirmation, 'revision' | 'result'>): Promise<void> {
        this.assertActive();
        this.state.confirmed = structuredClone(confirmed);
        await this.persist();
    }

    /** Сессия ждёт локальную очередь, но не неопределённо долгий сетевой ответ. */
    flush(): Promise<void> {
        return this.saveQueue;
    }

    forget(): void {
        this.state = lockedState();
    }

    private assertActive(): void {
        this.session.assertActive(this.epoch);
    }

    private async handleTransportFailure(error: unknown): Promise<void> {
        if (!this.session.isActive(this.epoch)) {
            return;
        }

        const code = isRecord(error) ? error.code : undefined;

        if (code === 'ACCESS_REQUIRED') {
            await this.session.lock();
            return;
        }

        this.state.status = FINAL_REJECTION_CODES.has(String(code)) ? 'conflict' : 'unknown';
        await this.persist();
    }

    private async acceptConfirmation(pending: PreparedOperation, confirmation: OperationConfirmation): Promise<void> {
        const matchesCommand =
            confirmation &&
            confirmation.operationId === pending.command.operationId &&
            confirmation.recoveryGeneration === pending.command.recoveryGeneration;

        if (!matchesCommand) {
            this.state.status = 'unknown';
            await this.persist();
            throw new DraftError('CONFIRMATION_MISMATCH');
        }

        this.state.lastReceipt = structuredClone(confirmation);

        if (
            !this.state.confirmed ||
            this.state.confirmed.revision === pending.command.baseRevision ||
            this.state.confirmed.revision === confirmation.revision
        ) {
            this.state.confirmed = structuredClone(confirmation);
        }

        this.state.pending = undefined;

        // Ввод мог продолжиться во время запроса. Удаляем только отправленную правку,
        // а более свежие поля оставляем с прежней базовой редакцией для явной сверки.
        if (this.state.localRevision === pending.localRevision) {
            this.state.fields = null;
        }

        this.state.status = this.state.fields === null ? 'confirmed' : 'draft';
        await this.persist();
    }

    private persist(): Promise<void> {
        const targetStatus = this.state.status === 'saving' ? this.desiredStatus : this.state.status;
        this.desiredStatus = targetStatus;
        const snapshot: EditorState = { ...structuredClone(this.state), status: targetStatus };
        const version = ++this.saveVersion;
        this.state.status = 'saving';

        const task = this.saveQueue.then(async () => {
            try {
                this.storageRevision = await this.storage.save(this.draftId, this.storageRevision, snapshot);

                // Старый commit не завершает более новую, ещё ожидающую запись.
                if (version === this.saveVersion) {
                    this.state.status = targetStatus;
                }
            } catch (error: unknown) {
                this.state.status = 'memory';
                throw error instanceof DraftError ? error : new DraftError('LOCAL_STORAGE_FAILED');
            }
        });

        this.saveQueue = task.catch(() => {
            // Ошибку получает вызвавший edit/prepare/send, а состояние уже memory.
            // Внутренняя очередь должна продолжиться для retryLocal и очистки при выходе.
            return;
        });

        return task;
    }
}
