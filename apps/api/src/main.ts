import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import express from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppModule } from './app.module';

async function bootstrap() {
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT должен быть целым числом от 1 до 65535.');
  }

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  const webRoot = resolve(process.cwd(), 'dist/web');
  if (existsSync(resolve(webRoot, 'index.html'))) {
    app.use(express.static(webRoot));
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (req.method !== 'GET' || !['/', '/calculator', '/calculator/', '/diary', '/diary/'].includes(req.path) || !req.accepts('html')) {
        next();
        return;
      }
      res.sendFile('index.html', { root: webRoot });
    });
  }
  await app.listen(port, '127.0.0.1');
}

void bootstrap().catch(() => {
  console.error('Не удалось запустить локальный сервер. Проверьте порт и конфигурацию.');
  process.exitCode = 1;
});
