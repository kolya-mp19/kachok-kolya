import { Module, type DynamicModule } from '@nestjs/common';
import { createStorage } from './storage.js';
import { StorageService } from './storage.service.js';
import { STORAGE_CLIENT } from './storage.tokens.js';

@Module({})
export class StorageModule {
  /** Подключается только потребителем БД: оболочка и health не требуют PostgreSQL. */
  static register(databaseUrl: string | undefined): DynamicModule {
    return {
      module: StorageModule,
      providers: [{ provide: STORAGE_CLIENT, useFactory: () => createStorage(databaseUrl) }, StorageService],
      exports: [STORAGE_CLIENT],
    };
  }
}
