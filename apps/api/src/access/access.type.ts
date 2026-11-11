export type VerifiedAccess = {
  readonly athleteId: string;
};

/** Адаптер проверяет актуальную сессию и защиту изменения при каждом вызове. */
export type AccessVerifier<Credential> = (credential: Credential) => Promise<VerifiedAccess | null>;

export const ACCESS_VERIFIER = Symbol('ACCESS_VERIFIER');
