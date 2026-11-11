import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

// tsc и tsx по-разному работают с metadata декораторов. Проверяем оба пути
// реальным контейнером NestJS, иначе typecheck не заметит сломанное внедрение.
for (const mode of ['compiled', 'source']) {
  test(`модули операций разрешают зависимости NestJS: ${mode}`, () => {
    const root = mode === 'source' ? './apps/api/src' : './dist/api';
    const extension = mode === 'source' ? 'ts' : 'js';
    const script = `
      import 'reflect-metadata';
      import assert from 'node:assert/strict';
      import { NestFactory } from '@nestjs/core';
      import { OperationsModule } from '${root}/operations/operations.module.${extension}';
      import { OperationsService } from '${root}/operations/operations.service.${extension}';

      let verifications = 0;
      const module = OperationsModule.register({
        databaseUrl: 'postgresql://synthetic:synthetic@127.0.0.1:1/synthetic',
        recoveryGeneration: 'generation-test',
        verifyAccess: async () => {
          verifications++;
          return null;
        },
      });
      const app = await NestFactory.createApplicationContext(module, { logger: false });
      try {
        const operations = app.get(OperationsService);
        await assert.rejects(operations.getDraftKey('invalid-session', 'athlete-a'), { code: 'ACCESS_REQUIRED' });
        assert.equal(verifications, 1);
      } finally {
        await app.close();
      }
    `;
    const arguments_ = mode === 'source' ? ['--import', 'tsx'] : [];
    const result = spawnSync(process.execPath, [...arguments_, '--input-type=module', '--eval', script], {
      encoding: 'utf8',
      env: { ...process.env, TSX_TSCONFIG_PATH: 'apps/api/tsconfig.json' },
      timeout: 15000,
    });

    assert.equal(result.status, 0, result.stdout + result.stderr);
  });
}
