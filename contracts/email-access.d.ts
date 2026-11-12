export type RegistrationRequest = { name: string; email: string; password: string };
export type PasswordLoginRequest = { email: string; password: string };
export type RegistrationResponse = { status: 'sent'; pendingId: string };
export type AuthAttemptResponse = { csrfToken: string };
export type DiaryIdentity = { athleteId: string; diaryId: string; name: string };
export type SessionResponse = DiaryIdentity & { csrfToken?: string };
export type RecoveryRequest = { email: string };
export type RecoveryConfirmationRequest = { token: string; password: string };
/** Принятый запрос не доказывает существование адреса или доставку письма. */
export type RecoveryResponse = { status: 'accepted'; pendingId: string };
