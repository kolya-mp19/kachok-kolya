export class OwnedOperationError extends Error {
  constructor(readonly code: 'ACCESS_REQUIRED' | 'OWNER_MISMATCH') {
    super(code);
  }
}
