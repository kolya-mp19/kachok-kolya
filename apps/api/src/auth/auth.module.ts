import { Module, type DynamicModule } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module.js';
import { AUTH_CONFIG, readAuthConfig } from './auth.config.js';
import { AuthController } from './auth.controller.js';
import { AuthProtectionService } from './auth-protection.service.js';
import { AuthRepository } from './auth.repository.js';
import { RegistrationMailService } from './registration-mail.service.js';
import { RegistrationService } from './registration.service.js';
import { SessionRepository } from './session.repository.js';
import { SessionService } from './session.service.js';

@Module({})
export class AuthModule {
  static register(env: NodeJS.ProcessEnv): DynamicModule {
    return {
      module: AuthModule,
      // Клиент подключается лениво: health и калькулятор работают без PostgreSQL.
      // При отсутствии настройки доступ отвечает безопасным неуспехом, а не fake-сессией.
      imports: [StorageModule.register(env.DATABASE_URL ?? 'postgresql://unconfigured:unconfigured@127.0.0.1:1/unconfigured')],
      controllers: [AuthController],
      providers: [
        { provide: AUTH_CONFIG, useValue: readAuthConfig(env) },
        AuthRepository,
        AuthProtectionService,
        RegistrationMailService,
        RegistrationService,
        SessionRepository,
        SessionService,
      ],
    };
  }
}
