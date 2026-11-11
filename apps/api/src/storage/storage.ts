import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

export class StorageError extends Error {
  constructor(readonly code: 'STORAGE_CONFIG_INVALID' | 'STORAGE_UNAVAILABLE' | 'MIGRATION_FAILED', readonly stage: 'configuration' | 'connection' | 'migration') {
    super(code);
  }
}

export function createStorage(databaseUrl: string | undefined) {
  try {
    const url = new URL(databaseUrl ?? '');
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error();
    // Migrate понимает ?schema, pg — нет. Отклоняем расхождение до изменения БД.
    if (url.searchParams.has('schema') && url.searchParams.get('schema') !== 'public') throw new Error();
  } catch {
    throw new StorageError('STORAGE_CONFIG_INVALID', 'configuration');
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl, connectionTimeoutMillis: 3000 }),
    log: [],
  });
}

export async function checkStorage(storage: PrismaClient) {
  try {
    await storage.$queryRaw`SELECT 1`;
  } catch {
    throw new StorageError('STORAGE_UNAVAILABLE', 'connection');
  }
}

export async function appliedMigrations(storage: PrismaClient) {
  const rows = await storage.$queryRaw<{ migration_name: string }[]>`
    SELECT migration_name FROM "_prisma_migrations"
    WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name
  `;
  return rows.map((row) => row.migration_name);
}

export async function failedMigration(storage: PrismaClient) {
  const rows = await storage.$queryRaw<{ migration_name: string }[]>`
    SELECT migration_name FROM "_prisma_migrations"
    WHERE finished_at IS NULL AND rolled_back_at IS NULL ORDER BY started_at DESC LIMIT 1
  `;
  const name = rows[0]?.migration_name;
  return name && /^[a-zA-Z0-9_-]{1,128}$/.test(name) ? name : undefined;
}
