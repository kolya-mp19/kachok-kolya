import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { DiaryIdentity } from '../../../../contracts/email-access.js';
import { SessionRepository } from './session.repository.js';
import { hashSecret, newSecret } from './auth-secrets.js';
import { AuthError } from './auth.error.js';

export type IssuedSession = { token: string; csrfToken: string; expiresAt: Date };

@Injectable()
export class SessionService {
  constructor(@Inject(SessionRepository) private readonly sessions: SessionRepository) {}

  /** Создание сессии входит в транзакцию подтверждения: частичный успех не авторизует. */
  async issue(athleteId: string, previousToken: string | undefined, tx: Prisma.TransactionClient): Promise<IssuedSession> {
    const accessRevision = await this.sessions.findAccessRevision(athleteId, tx);
    const token = newSecret();
    const csrfToken = newSecret();
    const expiresAt = new Date(Date.now() + 90 * 86400000);
    await this.sessions.create(
      {
        tokenHash: hashSecret(token),
        csrfHash: hashSecret(csrfToken),
        athleteId,
        accessRevision,
        expiresAt,
        previousHash: previousToken ? hashSecret(previousToken) : undefined,
      },
      tx,
    );
    return { token, csrfToken, expiresAt };
  }

  async getIdentity(token: string | undefined): Promise<DiaryIdentity> {
    const now = new Date();
    const session = token ? await this.sessions.find(hashSecret(token)) : null;
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
      session.lastActiveAt.getTime() <= now.getTime() - 30 * 86400000 ||
      session.accessRevision !== session.athleteAccessRevision
    ) {
      throw new AuthError('ACCESS_REQUIRED');
    }
    await this.sessions.updateActivity(session.tokenHash, now);
    return session.identity;
  }
}
