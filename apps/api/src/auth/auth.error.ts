export type AuthErrorCode =
  | 'INVALID_INPUT'
  | 'INVALID_LOGIN'
  | 'ACCESS_REQUIRED'
  | 'CSRF_INVALID'
  | 'EMAIL_UNAVAILABLE'
  | 'CONFIRMATION_INVALID'
  | 'DELIVERY_FAILED'
  | 'RATE_LIMITED';

export class AuthError extends Error {
  constructor(readonly code: AuthErrorCode) {
    super(code);
  }
}
