import { Inject, Injectable } from '@nestjs/common';
import { PrismaClient, type Prisma } from '@prisma/client';
import { STORAGE_CLIENT } from '../storage/storage.tokens.js';

export type PasswordCredential = { athleteId: string; passwordHash: string | null; accessRevision: number };
export type LoginIdentity = {
  athleteId: string;
  diaryId: string;
  name: string;
  passwordHash: string | null;
  accessRevision: number;
};

@Injectable()
export class PasswordLoginRepository {
  constructor(@Inject(STORAGE_CLIENT) private readonly storage: PrismaClient) {}

  async findCredential(normalizedEmail: string): Promise<PasswordCredential | null> {
    const athlete = await this.storage.athlete.findUnique({
      where: { normalizedEmail },
      select: { id: true, passwordHash: true, accessRevision: true },
    });
    return athlete ? { athleteId: athlete.id, passwordHash: athlete.passwordHash, accessRevision: athlete.accessRevision } : null;
  }

  /**
   * Удерживает блокировку владельца до завершения tx. Проверка актуальности
   * доказательства и создание сессии должны использовать эту же транзакцию:
   * смена пароля не должна вклиниться после принятия старого доказательства.
   */
  async lockIdentity(athleteId: string, tx: Prisma.TransactionClient): Promise<LoginIdentity | null> {
    await tx.$queryRaw`SELECT id FROM "Athlete" WHERE id = ${athleteId}::uuid FOR UPDATE`;
    const athlete = await tx.athlete.findUnique({ where: { id: athleteId }, include: { diary: true } });
    if (!athlete?.diary) {
      return null;
    }
    return {
      athleteId: athlete.id,
      diaryId: athlete.diary.id,
      name: athlete.name,
      passwordHash: athlete.passwordHash,
      accessRevision: athlete.accessRevision,
    };
  }
}
