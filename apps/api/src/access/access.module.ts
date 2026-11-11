import { Module, type DynamicModule } from '@nestjs/common';
import { ACCESS_VERIFIER, type AccessVerifier } from './access.type.js';
import { OwnedOperationsService } from './owned-operations.service.js';

@Module({})
export class AccessModule {
  /** Реальный адаптер сессий подключается сервером, а не входными данными HTTP. */
  static register<Credential>(verifyAccess: AccessVerifier<Credential>): DynamicModule {
    return {
      module: AccessModule,
      providers: [{ provide: ACCESS_VERIFIER, useValue: verifyAccess }, OwnedOperationsService],
      exports: [OwnedOperationsService],
    };
  }
}
