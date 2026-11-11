export type DraftErrorCode =
    | 'LOCAL_STORAGE_FAILED'
    | 'LOCAL_REVISION_CONFLICT'
    | 'DRAFT_UNREADABLE'
    | 'ACCESS_REQUIRED'
    | 'PENDING_OPERATION'
    | 'CONFIRMATION_MISMATCH';

export class DraftError extends Error {
    constructor(readonly code: DraftErrorCode) {
        super(code);
    }
}
