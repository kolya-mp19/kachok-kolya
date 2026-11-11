import { Inject, Injectable } from '@nestjs/common';
import { ACCESS_VERIFIER, type AccessVerifier, type VerifiedAccess } from './access.type.js';
import { OwnedOperationError } from './owned-operation.error.js';

@Injectable()
export class OwnedOperationsService<Credential> {
  constructor(
    @Inject(ACCESS_VERIFIER)
    private readonly verifyAccess: AccessVerifier<Credential>,
  ) {}

  /**
   * Не кеширует доступ: ожидавшая блокировки команда должна заметить отзыв сессии.
   * Контекст копируется и замораживается, чтобы адаптер не мог подменить владельца позже.
   *
   * @throws OwnedOperationError Если доступ отсутствует или ожидается другой владелец.
   */
  async run<Result>(
    credential: Credential,
    expectedAthleteId: string,
    operation: (owner: VerifiedAccess) => Promise<Result>,
  ): Promise<Result> {
    const owner = await this.verifyAccess(credential);

    if (!owner || typeof owner.athleteId !== 'string' || !owner.athleteId.trim()) {
      throw new OwnedOperationError('ACCESS_REQUIRED');
    }

    if (owner.athleteId !== expectedAthleteId) {
      throw new OwnedOperationError('OWNER_MISMATCH');
    }

    return operation(Object.freeze({ athleteId: owner.athleteId }));
  }
}
