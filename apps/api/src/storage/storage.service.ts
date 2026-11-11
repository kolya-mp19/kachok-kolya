import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { STORAGE_CLIENT } from './storage.tokens.js';

@Injectable()
export class StorageService implements OnModuleDestroy {
  constructor(@Inject(STORAGE_CLIENT) private readonly storage: PrismaClient) {}

  async onModuleDestroy(): Promise<void> {
    await this.storage.$disconnect();
  }
}
