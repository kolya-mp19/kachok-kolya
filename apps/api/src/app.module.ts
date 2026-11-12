import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './auth/auth.module.js';

@Module({ imports: [HealthModule, AuthModule.register(process.env)] })
export class AppModule {}
