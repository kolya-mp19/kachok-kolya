import { openEncryptedDrafts } from '../encrypted-drafts';
import { DraftEditor } from './draft-editor';
import { DraftError } from './draft.error';
import { isRecord, parseEditorState } from './draft-parser';
import type { CipherRecord, DraftKeyMaterial, DraftSessionContext, EditorState } from './drafts.type';
import type { EncryptedDraftStorage } from './encrypted-draft-storage';

export class PendingInputSession implements DraftSessionContext {
    private suspended: CipherRecord[] = [];
    private readonly editors: DraftEditor[] = [];
    private readonly channel: BroadcastChannel;
    private isLocked = false;
    private isClosed = false;
    private isResuming = false;
    private locking: Promise<void> | undefined;
    private epoch = 0;

    constructor(
        readonly athleteId: string,
        private readonly keyId: string,
        private currentGeneration: string,
        private drafts: EncryptedDraftStorage,
        readonly persistentStorage: boolean,
        private readonly databaseName = 'kachok-drafts',
    ) {
        this.channel = new BroadcastChannel(databaseName + ':access');
        this.channel.onmessage = (event: MessageEvent<unknown>) => {
            if (isRecord(event.data) && event.data.kind === 'lock') {
                void this.lock(false);
            }
        };
    }

    get recoveryGeneration(): string {
        return this.currentGeneration;
    }

    async openEditor(draftId: string, baseRevision: string): Promise<DraftEditor> {
        const editorEpoch = this.epoch;
        this.assertActive(editorEpoch);
        const stored = await this.drafts.load(draftId);
        this.assertActive(editorEpoch);

        const state: EditorState = stored
            ? parseEditorState(stored.value)
            : { fields: null, baseRevision, localRevision: 0, status: 'draft' };

        // Вкладка могла закрыться после отправки без получения ответа.
        // Автоматический повтор не начинается: атлет должен повторить прежнюю команду явно.
        if (state.status === 'sending') {
            state.status = 'unknown';
        }

        if (stored && !stored.durable) {
            state.status = 'memory';
        }

        const editor = new DraftEditor(draftId, this, editorEpoch, this.drafts, state, stored?.revision ?? 0);
        this.editors.push(editor);

        return editor;
    }

    isActive(epoch: number): boolean {
        return !this.isLocked && !this.isClosed && this.epoch === epoch;
    }

    assertActive(epoch: number): void {
        if (!this.isActive(epoch)) {
            throw new DraftError('ACCESS_REQUIRED');
        }
    }

    /**
     * Скрывает поля синхронно, затем ждёт локальные записи и удаляет ключ.
     * Новый вход ждёт эту же очистку; поздние сетевые ответы прежней эпохи игнорируются.
     */
    lock(broadcast = true): Promise<void> {
        this.epoch++;

        if (this.isLocked) {
            return this.locking ?? Promise.resolve();
        }

        this.isLocked = true;
        this.locking = this.finishLock(this.drafts, [...this.editors], broadcast);

        return this.locking;
    }

    async resume(material: DraftKeyMaterial): Promise<void> {
        const sameOwnerAndKey = material.athleteId === this.athleteId && material.keyId === this.keyId;

        if (!this.isLocked || this.isClosed || this.isResuming || !sameOwnerAndKey) {
            throw new DraftError('ACCESS_REQUIRED');
        }

        this.isResuming = true;
        const resumeEpoch = this.epoch;

        try {
            await this.locking;
            const opened = await openEncryptedDrafts(material, this.databaseName, this.suspended);

            // Повторный lock во время импорта ключа отменяет ещё не завершённый вход.
            if (this.isClosed || this.epoch !== resumeEpoch) {
                opened.close();
                throw new DraftError('ACCESS_REQUIRED');
            }

            this.drafts = opened;
            this.currentGeneration = material.recoveryGeneration;
            this.suspended = [];
            this.editors.length = 0;
            this.epoch++;
            this.isLocked = false;
        } finally {
            this.isResuming = false;
        }
    }

    async close(): Promise<void> {
        this.isClosed = true;
        await this.lock(false);
        this.channel.close();
    }

    private async finishLock(
        storage: EncryptedDraftStorage,
        editors: DraftEditor[],
        broadcast: boolean,
    ): Promise<void> {
        if (broadcast) {
            this.channel.postMessage({ kind: 'lock' });
        }

        await Promise.all(editors.map((editor) => editor.flush()));
        editors.forEach((editor) => editor.forget());
        this.suspended = storage.close();
    }
}
