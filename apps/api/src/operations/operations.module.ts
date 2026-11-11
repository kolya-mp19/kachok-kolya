import { Module, type DynamicModule } from '@nestjs/common';
import { AccessModule } from '../access/access.module.js';
import type { AccessVerifier } from '../access/access.type.js';
import { StorageModule } from '../storage/storage.module.js';
import { DraftKeysRepository } from './draft-keys.repository.js';
import { OperationReceiptsRepository } from './operation-receipts.repository.js';
import { OperationsService } from './operations.service.js';
import { RECOVERY_GENERATION } from './operations.type.js';

type OperationsModuleOptions<Credential> = {
  databaseUrl: string | undefined;
  recoveryGeneration: string;
  verifyAccess: AccessVerifier<Credential>;
};

@Module({})
export class OperationsModule {
  /** Модуль остаётся закрытым, пока приложение не передаст серверный адаптер доступа. */
  static register<Credential>(options: OperationsModuleOptions<Credential>): DynamicModule {
    return {
      module: OperationsModule,
      imports: [StorageModule.register(options.databaseUrl), AccessModule.register(options.verifyAccess)],
      providers: [
        { provide: RECOVERY_GENERATION, useValue: options.recoveryGeneration },
        OperationReceiptsRepository,
        DraftKeysRepository,
        OperationsService,
      ],
      exports: [OperationsService],
    };
  }
}
