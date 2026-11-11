import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

/** У каждого сценария своя синтетическая БД: откат и конкурентные команды не влияют на соседние тесты. */
export async function withTestDatabase(run) {
  assert.ok(process.env.TEST_DATABASE_URL, 'Нужна отдельная синтетическая PostgreSQL: задайте TEST_DATABASE_URL по README');
  const url = new URL(process.env.TEST_DATABASE_URL);
  const admin = new pg.Client({ connectionString: url.toString() });
  const name = 'e005_' + randomUUID().replaceAll('-', '');

  await admin.connect();

  try {
    // Имя формируется только из UUID и фиксированного префикса, а не из пользовательского SQL.
    await admin.query(`CREATE DATABASE ${name}`);
    url.pathname = '/' + name;

    try {
      await run(url.toString());
    } finally {
      await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
    }
  } finally {
    await admin.end();
  }
}

export function runStorageCli(action, databaseUrl, config) {
  const arguments_ = ['--import', 'tsx', 'scripts/storage.mts', action];
  if (config) {
    arguments_.push('--config', config);
  }

  const result = spawnSync(process.execPath, arguments_, {
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });

  return { status: result.status, output: result.stdout + result.stderr };
}
