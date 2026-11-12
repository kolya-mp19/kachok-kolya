import { Inject, Injectable } from '@nestjs/common';
import { PrismaClient, type Prisma, type PendingEmailAction, type AuthAttempt } from '@prisma/client';
import { STORAGE_CLIENT } from '../storage/storage.tokens.js';
import type { DiaryIdentity } from '../../../../contracts/email-access.js';

export type NewRegistration = {
  name: string;
  email: string;
  normalizedEmail: string;
  passwordHash: string;
  tokenHash: string;
  attemptHash: string;
  expiresAt: Date;
};

type NewAuthAttempt = { tokenHash: string; csrfHash: string; expiresAt: Date };

@Injectable()
export class AuthRepository {
  constructor(@Inject(STORAGE_CLIENT) private readonly storage: PrismaClient) {}

  transaction<T>(run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.storage.$transaction(run);
  }

  async createAttempt(input: NewAuthAttempt): Promise<void> {
    await this.storage.authAttempt.create({ data: input });
  }

  findAttempt(tokenHash: string): Promise<AuthAttempt | null> {
    return this.storage.authAttempt.findUnique({ where: { tokenHash } });
  }

  async takeRateLimit(key: string, maximum: number, windowMs: number, now: Date): Promise<boolean> {
    // Атомарный UPSERT сохраняет лимит при нескольких процессах и одновременных запросах.
    const result = await this.storage.$queryRaw<{ count: number }[]>`
      INSERT INTO "AuthRateBucket" ("key", "windowStart", "count") VALUES (${key}, ${now}, 1)
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "AuthRateBucket"."windowStart" <= ${new Date(now.getTime() - windowMs)} THEN 1 ELSE "AuthRateBucket"."count" + 1 END,
        "windowStart" = CASE WHEN "AuthRateBucket"."windowStart" <= ${new Date(now.getTime() - windowMs)} THEN ${now} ELSE "AuthRateBucket"."windowStart" END
      RETURNING "count"
    `;
    return result[0].count <= maximum;
  }

  async emailExists(normalizedEmail: string, tx?: Prisma.TransactionClient): Promise<boolean> {
    return (await (tx ?? this.storage).athlete.count({ where: { normalizedEmail } })) > 0;
  }

  createRegistration(data: NewRegistration): Promise<PendingEmailAction> {
    return this.storage.pendingEmailAction.create({ data: { ...data, purpose: 'registration' } });
  }

  findPending(id: string, attemptHash: string): Promise<PendingEmailAction | null> {
    return this.storage.pendingEmailAction.findFirst({ where: { id, attemptHash, purpose: 'registration' } });
  }

  async markDelivery(id: string, isDelivered: boolean): Promise<void> {
    await this.storage.pendingEmailAction.update({
      where: { id },
      data: isDelivered ? { deliveredAt: new Date() } : { cancelledAt: new Date() },
    });
  }

  async lockRegistration(tokenHash: string, tx: Prisma.TransactionClient): Promise<PendingEmailAction | null> {
    const rows = await tx.$queryRaw<
      PendingEmailAction[]
    >`SELECT * FROM "PendingEmailAction" WHERE "tokenHash" = ${tokenHash} FOR UPDATE`;
    return rows[0] ?? null;
  }

  findRegistrationEmail(tokenHash: string, tx: Prisma.TransactionClient): Promise<{ normalizedEmail: string } | null> {
    return tx.pendingEmailAction.findUnique({ where: { tokenHash }, select: { normalizedEmail: true } });
  }

  async lockEmail(normalizedEmail: string, tx: Prisma.TransactionClient): Promise<void> {
    // Две разные ссылки одной почты не должны одновременно создать разных владельцев.
    // Ограничение UNIQUE остаётся последней защитой, включая записи других потоков.
    // void не десериализуется Prisma; результат блокировки не является данными.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${normalizedEmail}, 0))`;
  }

  async createAthlete(pending: PendingEmailAction, tx: Prisma.TransactionClient): Promise<DiaryIdentity> {
    const athlete = await tx.athlete.create({
      data: {
        name: pending.name,
        email: pending.email,
        normalizedEmail: pending.normalizedEmail,
        passwordHash: pending.passwordHash,
        diary: { create: {} },
      },
      include: { diary: true },
    });
    if (!athlete.diary) {
      throw new Error('DIARY_CREATION_FAILED');
    }
    return { athleteId: athlete.id, diaryId: athlete.diary.id, name: athlete.name };
  }

  async consumeRegistration(id: string, normalizedEmail: string, now: Date, tx: Prisma.TransactionClient): Promise<void> {
    await tx.pendingEmailAction.update({ where: { id }, data: { consumedAt: now } });
    // Остальные ожидающие письма адреса после создания аккаунта уже не пригодны.
    await tx.pendingEmailAction.updateMany({
      where: { normalizedEmail, purpose: 'registration', id: { not: id }, consumedAt: null },
      data: { cancelledAt: now },
    });
  }

  async cancelRegistration(id: string, attemptHash: string): Promise<void> {
    await this.storage.pendingEmailAction.updateMany({
      where: { id, attemptHash, consumedAt: null },
      data: { cancelledAt: new Date() },
    });
  }
}
