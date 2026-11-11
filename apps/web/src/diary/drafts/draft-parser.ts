import type { Json, OperationConfirmation, OperationEnvelope } from '../../../../../contracts/operation-protocol';
import { DraftError } from './draft.error';
import type { CipherRecord, EditorState, EditorStatus } from './drafts.type';

const EDITOR_STATUSES: readonly string[] = [
    'saving',
    'draft',
    'ready',
    'sending',
    'unknown',
    'confirmed',
    'conflict',
    'memory',
    'locked',
];

export function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isJson(value: unknown): value is Json {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') {
        return true;
    }

    if (typeof value === 'number') {
        return Number.isFinite(value);
    }

    if (Array.isArray(value)) {
        return value.every(isJson);
    }

    return isRecord(value) && Object.values(value).every(isJson);
}

function isRevision(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isEditorStatus(value: unknown): value is EditorStatus {
    return typeof value === 'string' && EDITOR_STATUSES.includes(value);
}

function isConfirmation(value: unknown): value is OperationConfirmation {
    return (
        isRecord(value) &&
        typeof value.operationId === 'string' &&
        typeof value.recoveryGeneration === 'string' &&
        isConfirmedValue(value)
    );
}

function isConfirmedValue(value: unknown): value is Pick<OperationConfirmation, 'revision' | 'result'> {
    return isRecord(value) && typeof value.revision === 'string' && isJson(value.result);
}

function isEnvelope(value: unknown): value is OperationEnvelope {
    if (!isRecord(value) || value.protocolVersion !== 1 || !isJson(value.payload)) {
        return false;
    }

    const stringFields = [
        'operationId',
        'recoveryGeneration',
        'athleteId',
        'commandType',
        'rootId',
        'baseRevision',
        'occurredOn',
    ];

    return stringFields.every((field) => typeof value[field] === 'string');
}

/** Даже успешная расшифровка не заменяет проверку формата сохранённого состояния. */
export function parseEditorState(value: unknown): EditorState {
    if (!isRecord(value) || !isJson(value.fields) || typeof value.baseRevision !== 'string') {
        throw new DraftError('DRAFT_UNREADABLE');
    }

    if (!isRevision(value.localRevision) || !isEditorStatus(value.status)) {
        throw new DraftError('DRAFT_UNREADABLE');
    }

    const state: EditorState = {
        fields: value.fields,
        baseRevision: value.baseRevision,
        localRevision: value.localRevision,
        status: value.status,
    };

    if (value.pending !== undefined) {
        if (
            !isRecord(value.pending) ||
            !isEnvelope(value.pending.command) ||
            !isRevision(value.pending.localRevision)
        ) {
            throw new DraftError('DRAFT_UNREADABLE');
        }

        state.pending = { command: value.pending.command, localRevision: value.pending.localRevision };
    }

    if (value.confirmed !== undefined) {
        if (!isConfirmedValue(value.confirmed)) {
            throw new DraftError('DRAFT_UNREADABLE');
        }

        state.confirmed = value.confirmed;
    }

    if (value.lastReceipt !== undefined) {
        if (!isConfirmation(value.lastReceipt)) {
            throw new DraftError('DRAFT_UNREADABLE');
        }

        state.lastReceipt = value.lastReceipt;
    }

    return state;
}

export function parseCipherRecord(value: unknown): CipherRecord {
    if (!isRecord(value) || value.format !== 1 || !isRevision(value.revision)) {
        throw new DraftError('DRAFT_UNREADABLE');
    }

    if (
        typeof value.id !== 'string' ||
        typeof value.athleteId !== 'string' ||
        typeof value.keyId !== 'string' ||
        typeof value.draftId !== 'string'
    ) {
        throw new DraftError('DRAFT_UNREADABLE');
    }

    if (
        !(value.iv instanceof Uint8Array) ||
        !(value.iv.buffer instanceof ArrayBuffer) ||
        !(value.ciphertext instanceof ArrayBuffer)
    ) {
        throw new DraftError('DRAFT_UNREADABLE');
    }

    return {
        id: value.id,
        format: 1,
        athleteId: value.athleteId,
        keyId: value.keyId,
        draftId: value.draftId,
        revision: value.revision,
        iv: new Uint8Array(value.iv),
        ciphertext: value.ciphertext,
    };
}
