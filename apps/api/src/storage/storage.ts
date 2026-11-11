import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { StorageError } from './storage.error.js';

export { StorageError } from './storage.error.js';

type MigrationRow = { migration_name: string };

/** Отклоняет настройки, которые Prisma Migrate и pg интерпретировали бы по-разному. */
export function createStorage(databaseUrl: string | undefined): PrismaClient {
  try {
    const url = new URL(databaseUrl ?? '');
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
      throw new StorageError('STORAGE_CONFIG_INVALID', 'configuration');
    }
    // Migrate понимает ?schema, pg — нет. Отклоняем расхождение до изменения БД.
    if (url.searchParams.has('schema') && url.searchParams.get('schema') !== 'public') {
      throw new StorageError('STORAGE_CONFIG_INVALID', 'configuration');
    }
  } catch {
    throw new StorageError('STORAGE_CONFIG_INVALID', 'configuration');
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl, connectionTimeoutMillis: 3000 }),
    log: [],
  });
}

export async function checkStorage(storage: PrismaClient): Promise<void> {
  try {
    await storage.$queryRaw`SELECT 1`;
  } catch {
    throw new StorageError('STORAGE_UNAVAILABLE', 'connection');
  }
}

export async function appliedMigrations(storage: PrismaClient): Promise<string[]> {
  const rows = await storage.$queryRaw<MigrationRow[]>`
    SELECT migration_name FROM "_prisma_migrations"
    WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name
  `;
  return rows.map((row) => row.migration_name);
}

/** Имя попадает в диагностику: произвольный текст из повреждённой таблицы не раскрываем. */
export async function failedMigration(storage: PrismaClient): Promise<string | undefined> {
  const rows = await storage.$queryRaw<MigrationRow[]>`
    SELECT migration_name FROM "_prisma_migrations"
    WHERE finished_at IS NULL AND rolled_back_at IS NULL ORDER BY started_at DESC LIMIT 1
  `;
  const name = rows[0]?.migration_name;
  return name && /^[a-zA-Z0-9_-]{1,128}$/.test(name) ? name : undefined;
}
