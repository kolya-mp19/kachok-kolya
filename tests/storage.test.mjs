import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import pg from 'pg';
import { withTestDatabase, runStorageCli } from './helpers/test-database.mjs';
import { removeTestDirectory } from './helpers/test-directory.mjs';

test('недоступное хранилище возвращает безопасную диагностику', () => {
  const result = runStorageCli('check', 'postgresql://secret_user:secret_password@127.0.0.1:1/private_db');
  assert.equal(result.status, 1);
  assert.deepEqual(JSON.parse(result.output), { code: 'STORAGE_UNAVAILABLE', stage: 'connection' });
});

test('чистая схема, повтор миграции и новый процесс сохраняют версию', { timeout: 60000 }, async () => {
  await withTestDatabase(async (url) => {
    assert.equal(runStorageCli('migrate', url).status, 0);
    const first = runStorageCli('status', url);
    assert.equal(first.status, 0, first.output);
    assert.deepEqual(JSON.parse(first.output).migrations, [
      '202611110001_storage_foundation',
      '202611110002_draft_keys',
      '202611110003_operation_receipts',
    ]);
    assert.equal(runStorageCli('migrate', url).status, 0);
    assert.deepEqual(runStorageCli('status', url), first);
  });
});

test('неподдерживаемая схема отклоняется до подключения и применения миграции', () => {
  const result = runStorageCli('migrate', 'postgresql://secret:secret@127.0.0.1:1/unavailable?schema=another');
  assert.equal(result.status, 1);
  assert.deepEqual(JSON.parse(result.output), { code: 'STORAGE_CONFIG_INVALID', stage: 'configuration' });
});

test('обновление прежней схемы сохраняет проверочную запись, неуспех не раскрывает SQL', { timeout: 60000 }, async () => {
  await withTestDatabase(async (url) => {
    await mkdir('.scratch', { recursive: true });
    const dir = await mkdtemp(resolve('.scratch/storage-migration-'));
    const config = join(dir, 'prisma.config.ts');
    const migrations = join(dir, 'migrations');
    const fixture = new pg.Client({ connectionString: url });
    await fixture.connect();
    try {
      await mkdir(join(migrations, '001_previous'), { recursive: true });
      await writeFile(join(migrations, 'migration_lock.toml'), 'provider = "postgresql"\n');
      await writeFile(
        join(migrations, '001_previous/migration.sql'),
        'CREATE TABLE evidence (id integer PRIMARY KEY, text text NOT NULL);',
      );
      await writeFile(
        config,
        `import { defineConfig } from 'prisma/config';\nexport default defineConfig({schema:${JSON.stringify(resolve('prisma/schema.prisma'))},migrations:{path:${JSON.stringify(migrations)}},datasource:{url:process.env.DATABASE_URL}});`,
      );
      assert.equal(runStorageCli('migrate', url, config).status, 0);
      await fixture.query('INSERT INTO evidence VALUES ($1, $2)', [7, 'проверочная запись']);
      await mkdir(join(migrations, '002_update'));
      await writeFile(
        join(migrations, '002_update/migration.sql'),
        'ALTER TABLE evidence ADD COLUMN revision integer NOT NULL DEFAULT 1;',
      );
      assert.equal(runStorageCli('migrate', url, config).status, 0);
      assert.deepEqual((await fixture.query('SELECT * FROM evidence')).rows, [
        { id: 7, text: 'проверочная запись', revision: 1 },
      ]);
      await mkdir(join(migrations, '003_broken'));
      const secret = 'control_secret_' + randomUUID().replaceAll('-', '');
      await writeFile(
        join(migrations, '003_broken/migration.sql'),
        `BEGIN; INSERT INTO evidence VALUES (8, '${secret}', 1); SELECT missing_${secret}(); COMMIT;`,
      );
      const broken = runStorageCli('migrate', url, config);
      assert.equal(broken.status, 1);
      assert.deepEqual(JSON.parse(broken.output), { code: 'MIGRATION_FAILED', stage: 'migration', migration: '003_broken' });
      assert.deepEqual((await fixture.query('SELECT * FROM evidence')).rows, [
        { id: 7, text: 'проверочная запись', revision: 1 },
      ]);
      assert.equal(runStorageCli('status', url, config).status, 1);
      const logs = spawnSync('docker', ['compose', 'logs', '--no-color', 'postgres'], { encoding: 'utf8' });
      assert.equal(logs.status, 0, 'Для проверки журналов нужна локальная PostgreSQL из Compose');
      assert.equal(
        (logs.stdout + logs.stderr).includes(secret),
        false,
        'Ошибка SQL не должна раскрывать контрольный секрет в журнале БД',
      );
    } finally {
      await fixture.end();
      await removeTestDirectory(dir, resolve('.scratch'));
    }
  });
});
