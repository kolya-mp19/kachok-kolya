import type { Json, OperationConfirmation, OperationEnvelope } from '../../../../../contracts/operation-protocol';

/** Приходит только от серверного адаптера после проверки текущей сессии. */
export type DraftKeyMaterial = {
    athleteId: string;
    keyId: string;
    key: string;
    recoveryGeneration: string;
};

export type CipherMetadata = {
    format: 1;
    athleteId: string;
    keyId: string;
    draftId: string;
    revision: number;
};

export type CipherRecord = CipherMetadata & {
    id: string;
    iv: Uint8Array<ArrayBuffer>;
    ciphertext: ArrayBuffer;
};

export type StoredDraft = {
    revision: number;
    durable: boolean;
    value: unknown;
};

export type EditorStatus =
    'saving' | 'draft' | 'ready' | 'sending' | 'unknown' | 'confirmed' | 'conflict' | 'memory' | 'locked';

export type PreparedOperation = {
    command: OperationEnvelope;
    localRevision: number;
};

/** Формат сохраняется совместимым с уже зашифрованными черновиками первой версии. */
export type EditorState = {
    fields: Json;
    baseRevision: string;
    localRevision: number;
    status: EditorStatus;
    pending?: PreparedOperation;
    confirmed?: Pick<OperationConfirmation, 'revision' | 'result'>;
    lastReceipt?: OperationConfirmation;
};

export type PrepareCommandParams = Pick<OperationEnvelope, 'commandType' | 'rootId' | 'payload' | 'occurredOn'>;
export type OperationTransport = (command: OperationEnvelope) => Promise<OperationConfirmation>;

/** Старый handle редактора остаётся недействительным и после нового входа. */
export interface DraftSessionContext {
    readonly athleteId: string;
    readonly recoveryGeneration: string;
    isActive(epoch: number): boolean;
    assertActive(epoch: number): void;
    lock(broadcast?: boolean): Promise<void>;
}
