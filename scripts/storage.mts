import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { createStorage, checkStorage, appliedMigrations, failedMigration, StorageError } from '../apps/api/src/storage/storage.js';

const action = process.argv[2];
let storage: ReturnType<typeof createStorage> | undefined;
try {
  if (!['check', 'migrate', 'status'].includes(action)) throw new StorageError('STORAGE_CONFIG_INVALID', 'configuration');
  const config = process.argv.slice(3);
  if (config.length && (config.length !== 2 || config[0] !== '--config')) throw new StorageError('STORAGE_CONFIG_INVALID', 'configuration');
  storage = createStorage(process.env.DATABASE_URL);
  await checkStorage(storage);
  if (action === 'check') {
    process.stdout.write(JSON.stringify({ code: 'STORAGE_READY', stage: 'connection' }) + '\n');
  } else {
    const args = action === 'migrate' ? ['migrate', 'deploy'] : ['migrate', 'status'];
    const child = spawn(process.execPath, [resolve('node_modules/prisma/build/index.js'), ...args, ...config], {
      stdio: 'pipe', env: process.env,
    });
    // Сырой вывод Prisma может содержать SQL, URL и содержимое записей.
    child.stdout.resume();
    child.stderr.resume();
    const status = await new Promise<number | null>((done, reject) => {
      child.on('error', reject);
      child.on('close', done);
    });
    if (status !== 0) throw new StorageError('MIGRATION_FAILED', 'migration');
    process.stdout.write(JSON.stringify({ code: action === 'migrate' ? 'MIGRATIONS_APPLIED' : 'SCHEMA_CURRENT', stage: 'migration', migrations: await appliedMigrations(storage) }) + '\n');
  }
} catch (error) {
  const safe = error instanceof StorageError ? error : new StorageError('MIGRATION_FAILED', 'migration');
  let migration: string | undefined;
  if (safe.code === 'MIGRATION_FAILED' && storage) {
    try { migration = await failedMigration(storage); } catch { /* Сырой отказ диагностики также не раскрывается. */ }
  }
  process.stderr.write(JSON.stringify({ code: safe.code, stage: safe.stage, migration }) + '\n');
  process.exitCode = 1;
} finally {
  await storage?.$disconnect();
}
