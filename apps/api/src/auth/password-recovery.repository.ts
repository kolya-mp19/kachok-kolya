import { Inject, Injectable } from '@nestjs/common';
import { PrismaClient, type Prisma, type PasswordRecovery } from '@prisma/client';
import { STORAGE_CLIENT } from '../storage/storage.tokens.js';

type RecoveryAccount = { id: string; email: string; accessRevision: number };
type NewRecovery = {
  tokenHash: string;
  normalizedEmail: string;
  athleteId: string | null;
  accessRevision: number | null;
  attemptHash: string;
  expiresAt: Date;
};
type ResetPasswordData = { athleteId: string; recoveryId: string; passwordHash: string; now: Date };

@Injectable()
export class PasswordRecoveryRepository {
  constructor(@Inject(STORAGE_CLIENT) private readonly storage: PrismaClient) {}

  findAccount(normalizedEmail: string): Promise<RecoveryAccount | null> {
    return this.storage.athlete.findUnique({
      where: { normalizedEmail },
      select: { id: true, email: true, accessRevision: true },
    });
  }

  create(input: NewRecovery): Promise<PasswordRecovery> {
    return this.storage.passwordRecovery.create({ data: input });
  }

  findToken(tokenHash: string, tx?: Prisma.TransactionClient): Promise<PasswordRecovery | null> {
    return (tx ?? this.storage).passwordRecovery.findUnique({ where: { tokenHash } });
  }

  findPending(id: string, attemptHash: string): Promise<PasswordRecovery | null> {
    return this.storage.passwordRecovery.findFirst({ where: { id, attemptHash } });
  }

  async markDelivery(id: string, isDelivered: boolean): Promise<void> {
    await this.storage.passwordRecovery.update({
      where: { id },
      data: isDelivered ? { deliveredAt: new Date() } : { deliveryFailedAt: new Date() },
    });
  }

  async cancel(id: string, attemptHash: string): Promise<void> {
    await this.storage.passwordRecovery.updateMany({
      where: { id, attemptHash, consumedAt: null },
      data: { cancelledAt: new Date() },
    });
  }

  /**
   * Вызывается после блокировки Athlete: все восстановления и вход по паролю
   * используют один порядок владельца, не удерживая разные токены навстречу друг другу.
   */
  async lockToken(tokenHash: string, tx: Prisma.TransactionClient): Promise<PasswordRecovery | null> {
    const rows = await tx.$queryRaw<
      PasswordRecovery[]
    >`SELECT * FROM "PasswordRecovery" WHERE "tokenHash" = ${tokenHash} FOR UPDATE`;
    return rows[0] ?? null;
  }

  /**
   * Вызывается в общей транзакции после блокировок Athlete и токена и проверки
   * назначения, доставки, срока, редакции и однократности в сервисе.
   * Меняет только пароль/редакцию и записи доступа: дневник и его данные сохраняются.
   * Отказ любой записи откатывает смену пароля, отзыв и потребление токена вместе.
   */
  async resetPassword(input: ResetPasswordData, tx: Prisma.TransactionClient): Promise<void> {
    await tx.athlete.update({
      where: { id: input.athleteId },
      data: { passwordHash: input.passwordHash, accessRevision: { increment: 1 } },
    });
    await tx.authSession.updateMany({ where: { athleteId: input.athleteId, revokedAt: null }, data: { revokedAt: input.now } });
    await tx.passwordRecovery.update({ where: { id: input.recoveryId }, data: { consumedAt: input.now } });
    await tx.passwordRecovery.updateMany({
      where: { athleteId: input.athleteId, id: { not: input.recoveryId }, consumedAt: null },
      data: { cancelledAt: input.now },
    });
  }
}
