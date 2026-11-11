import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { resolve } from 'node:path';
import { AppModule } from './app.module.js';
import { configureWeb } from './web/configure-web.js';

async function bootstrap(): Promise<void> {
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT должен быть целым числом от 1 до 65535.');
  }

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  configureWeb(app, resolve(process.cwd(), 'dist/web'));
  await app.listen(port, '127.0.0.1');
}

void bootstrap().catch(() => {
  console.error('Не удалось запустить локальный сервер. Проверьте порт и конфигурацию.');
  process.exitCode = 1;
});
