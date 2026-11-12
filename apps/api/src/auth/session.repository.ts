import { Inject, Injectable } from '@nestjs/common';
import { PrismaClient, type Prisma, type AuthSession } from '@prisma/client';
import { STORAGE_CLIENT } from '../storage/storage.tokens.js';
import type { DiaryIdentity } from '../../../../contracts/email-access.js';

export type StoredSession = AuthSession & { identity: DiaryIdentity; athleteAccessRevision: number };
type NewAuthSession = { tokenHash: string; csrfHash: string; athleteId: string; expiresAt: Date; previousHash?: string };

@Injectable()
export class SessionRepository {
  constructor(@Inject(STORAGE_CLIENT) private readonly storage: PrismaClient) {}

  async create(input: NewAuthSession, tx: Prisma.TransactionClient): Promise<void> {
    if (input.previousHash) {
      await tx.authSession.updateMany({
        where: { tokenHash: input.previousHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await tx.authSession.create({
      data: {
        tokenHash: input.tokenHash,
        csrfHash: input.csrfHash,
        athleteId: input.athleteId,
        accessRevision: 1,
        expiresAt: input.expiresAt,
      },
    });
  }

  async find(tokenHash: string): Promise<StoredSession | null> {
    const session = await this.storage.authSession.findUnique({
      where: { tokenHash },
      include: { athlete: { include: { diary: true } } },
    });
    if (!session || !session.athlete.diary) {
      return null;
    }
    return {
      ...session,
      athleteAccessRevision: session.athlete.accessRevision,
      identity: { athleteId: session.athleteId, diaryId: session.athlete.diary.id, name: session.athlete.name },
    };
  }

  async updateActivity(tokenHash: string, now: Date): Promise<void> {
    await this.storage.authSession.updateMany({ where: { tokenHash, revokedAt: null }, data: { lastActiveAt: now } });
  }
}
