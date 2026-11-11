import { randomBytes, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaClient, type DraftKey } from '@prisma/client';
import { STORAGE_CLIENT } from '../storage/storage.tokens.js';

@Injectable()
export class DraftKeysRepository {
  constructor(@Inject(STORAGE_CLIENT) private readonly storage: PrismaClient) {}

  async findByAthleteId(athleteId: string): Promise<DraftKey | null> {
    return this.storage.draftKey.findUnique({ where: { athleteId } });
  }

  /** Параллельные первые запросы получают один ключ; существующий ключ не заменяется. */
  async createIfMissing(athleteId: string): Promise<DraftKey> {
    return this.storage.draftKey.upsert({
      where: { athleteId },
      update: {},
      create: { athleteId, keyId: randomUUID(), key: randomBytes(32) },
    });
  }
}
