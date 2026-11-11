import type { INestApplication } from '@nestjs/common';
import express from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const SPA_ENTRY_PATHS = new Set(['/', '/calculator', '/calculator/', '/diary', '/diary/']);

/**
 * SPA fallback ограничен известными входами: неизвестный /api должен оставаться
 * JSON-ошибкой API, иначе клиент может принять HTML за ответ своего запроса.
 */
export function configureWeb(app: INestApplication, webRoot: string): void {
  if (!existsSync(resolve(webRoot, 'index.html'))) {
    return;
  }

  app.use(express.static(webRoot));
  app.use((request: express.Request, response: express.Response, next: express.NextFunction) => {
    if (request.method !== 'GET' || !SPA_ENTRY_PATHS.has(request.path) || !request.accepts('html')) {
      next();
      return;
    }

    response.sendFile('index.html', { root: webRoot });
  });
}
