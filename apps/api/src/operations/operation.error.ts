export type OperationErrorCode =
  | 'DRAFT_KEY_MISSING'
  | 'REVISION_CONFLICT'
  | 'OPERATION_ID_CONFLICT'
  | 'RECOVERY_GENERATION_MISMATCH'
  | 'INVALID_OPERATION'
  | 'OPERATION_FAILED'
  | 'OPERATION_REJECTED';

export class OperationError extends Error {
  constructor(readonly code: OperationErrorCode) {
    super(code);
  }
}
