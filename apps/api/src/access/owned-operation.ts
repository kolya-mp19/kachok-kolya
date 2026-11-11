export interface VerifiedAccess {
  readonly athleteId: string;
}

export class OwnedOperationError extends Error {
  constructor(readonly code: 'ACCESS_REQUIRED' | 'OWNER_MISMATCH') {
    super(code);
  }
}

// Подключается серверной сборкой приложения. Адаптер проверяет текущий доступ,
// включая сессию и защиту изменения; он не является частью клиентского запроса.
export function createOwnedOperations<Credential>(
  verifyAccess: (credential: Credential) => Promise<VerifiedAccess | null>,
) {
  return {
    async run<Result>(
      credential: Credential,
      expectedAthleteId: string,
      operation: (owner: VerifiedAccess) => Promise<Result>,
    ): Promise<Result> {
      const owner = await verifyAccess(credential);
      if (!owner || typeof owner.athleteId !== 'string' || !owner.athleteId.trim()) {
        throw new OwnedOperationError('ACCESS_REQUIRED');
      }
      if (owner.athleteId !== expectedAthleteId) throw new OwnedOperationError('OWNER_MISMATCH');
      return operation(Object.freeze({ athleteId: owner.athleteId }));
    },
  };
}
