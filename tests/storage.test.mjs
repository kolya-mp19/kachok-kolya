import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import pg from 'pg';

function command(action, url, config) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/storage.mts', action, ...(config ? ['--config', config] : [])], {
    encoding: 'utf8', env: { ...process.env, DATABASE_URL: url },
  });
  return { status: result.status, output: result.stdout + result.stderr };
}

test('недоступное хранилище возвращает безопасную диагностику', () => {
  const result = command('check', 'postgresql://secret_user:secret_password@127.0.0.1:1/private_db');
  assert.equal(result.status, 1);
  assert.deepEqual(JSON.parse(result.output), { code: 'STORAGE_UNAVAILABLE', stage: 'connection' });
});

async function database(run) {
  const base = process.env.TEST_DATABASE_URL;
  assert.ok(base, 'Нужна отдельная синтетическая PostgreSQL: задайте TEST_DATABASE_URL по README');
  const name = 'e005_' + randomUUID().replaceAll('-', '');
  const admin = new pg.Client({ connectionString: base });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  const url = new URL(base);
  url.pathname = '/' + name;
  try { await run(url.toString()); } finally {
    await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
    await admin.end();
  }
}

test('чистая схема, повтор миграции и новый процесс сохраняют версию', { timeout: 60000 }, async () => {
  await database(async (url) => {
    assert.equal(command('migrate', url).status, 0);
    const first = command('status', url);
    assert.equal(first.status, 0, first.output);
    assert.deepEqual(JSON.parse(first.output).migrations, ['202611110001_storage_foundation']);
    assert.equal(command('migrate', url).status, 0);
    assert.deepEqual(command('status', url), first);
  });
});

test('неподдерживаемая схема отклоняется до подключения и применения миграции', () => {
  const result = command('migrate', 'postgresql://secret:secret@127.0.0.1:1/unavailable?schema=another');
  assert.equal(result.status, 1);
  assert.deepEqual(JSON.parse(result.output), { code: 'STORAGE_CONFIG_INVALID', stage: 'configuration' });
});

test('обновление прежней схемы сохраняет проверочную запись, неуспех не раскрывает SQL', { timeout: 60000 }, async () => {
  await database(async (url) => {
    await mkdir('.scratch', { recursive: true });
    const dir = await mkdtemp(resolve('.scratch/storage-migration-'));
    const config = join(dir, 'prisma.config.ts');
    const migrations = join(dir, 'migrations');
    const fixture = new pg.Client({ connectionString: url });
    await fixture.connect();
    try {
      await mkdir(join(migrations, '001_previous'), { recursive: true });
      await writeFile(join(migrations, 'migration_lock.toml'), 'provider = "postgresql"\n');
      await writeFile(join(migrations, '001_previous/migration.sql'), 'CREATE TABLE evidence (id integer PRIMARY KEY, text text NOT NULL);');
      await writeFile(config, `import { defineConfig } from 'prisma/config';\nexport default defineConfig({schema:${JSON.stringify(resolve('prisma/schema.prisma'))},migrations:{path:${JSON.stringify(migrations)}},datasource:{url:process.env.DATABASE_URL}});`);
      assert.equal(command('migrate', url, config).status, 0);
      await fixture.query('INSERT INTO evidence VALUES ($1, $2)', [7, 'проверочная запись']);
      await mkdir(join(migrations, '002_update'));
      await writeFile(join(migrations, '002_update/migration.sql'), 'ALTER TABLE evidence ADD COLUMN revision integer NOT NULL DEFAULT 1;');
      assert.equal(command('migrate', url, config).status, 0);
      assert.deepEqual((await fixture.query('SELECT * FROM evidence')).rows, [{ id: 7, text: 'проверочная запись', revision: 1 }]);
      await mkdir(join(migrations, '003_broken'));
      const secret = 'control_secret_' + randomUUID().replaceAll('-', '');
      await writeFile(join(migrations, '003_broken/migration.sql'), `BEGIN; INSERT INTO evidence VALUES (8, '${secret}', 1); SELECT missing_${secret}(); COMMIT;`);
      const broken = command('migrate', url, config);
      assert.equal(broken.status, 1);
      assert.deepEqual(JSON.parse(broken.output), { code: 'MIGRATION_FAILED', stage: 'migration', migration: '003_broken' });
      assert.deepEqual((await fixture.query('SELECT * FROM evidence')).rows, [{ id: 7, text: 'проверочная запись', revision: 1 }]);
      assert.equal(command('status', url, config).status, 1);
      const logs = spawnSync('docker', ['compose', 'logs', '--no-color', 'postgres'], { encoding: 'utf8' });
      assert.equal(logs.status, 0, 'Для проверки журналов нужна локальная PostgreSQL из Compose');
      assert.equal((logs.stdout + logs.stderr).includes(secret), false, 'Ошибка SQL не должна раскрывать контрольный секрет в журнале БД');
    } finally {
      await fixture.end();
      await rm(dir, { recursive: true, force: true });
    }
  });
});
