import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { appliedMigrations, checkStorage, createStorage, failedMigration } from '../apps/api/src/storage/storage.js';
import { StorageError, type StorageStage } from '../apps/api/src/storage/storage.error.js';

type StorageAction = 'check' | 'migrate' | 'status';

type StorageCommand = {
  action: StorageAction;
  configArguments: string[];
};

type StorageReport = {
  code: string;
  stage: StorageStage;
  migrations?: string[];
  migration?: string;
};

type StorageCommandResult = {
  exitCode: number;
  report: StorageReport;
};

function parseCommand(arguments_: string[]): StorageCommand {
  const [action, ...configArguments] = arguments_;

  if (action !== 'check' && action !== 'migrate' && action !== 'status') {
    throw new StorageError('STORAGE_CONFIG_INVALID', 'configuration');
  }

  if (configArguments.length > 0 && (configArguments.length !== 2 || configArguments[0] !== '--config')) {
    throw new StorageError('STORAGE_CONFIG_INVALID', 'configuration');
  }

  return { action, configArguments };
}

async function runPrismaMigration(command: StorageCommand): Promise<void> {
  const actionArguments = command.action === 'migrate' ? ['migrate', 'deploy'] : ['migrate', 'status'];
  const child = spawn(
    process.execPath,
    [resolve('node_modules/prisma/build/index.js'), ...actionArguments, ...command.configArguments],
    { stdio: 'pipe', env: process.env },
  );

  // Даже сообщение об ошибке Prisma может содержать SQL, URL или содержимое записей.
  // Вывод потребляется, чтобы не заблокировать процесс, но наружу идут только безопасные коды.
  child.stdout.resume();
  child.stderr.resume();

  const status = await new Promise<number | null>((resolveExit, reject) => {
    child.on('error', reject);
    child.on('close', resolveExit);
  });

  if (status !== 0) {
    throw new StorageError('MIGRATION_FAILED', 'migration');
  }
}

async function diagnoseFailedMigration(storage: PrismaClient | undefined): Promise<string | undefined> {
  if (!storage) {
    return undefined;
  }

  try {
    return await failedMigration(storage);
  } catch {
    // Диагностика может отказать по той же причине, что миграция. Первичный безопасный
    // код сохраняется; исходное исключение и SQL диагностического запроса не раскрываются.
    return undefined;
  }
}

/** CLI не запускает NestJS: миграции и проверка соединения имеют собственный жизненный цикл. */
export async function runStorageCommand(arguments_: string[], databaseUrl: string | undefined): Promise<StorageCommandResult> {
  let storage: PrismaClient | undefined;

  try {
    const command = parseCommand(arguments_);
    storage = createStorage(databaseUrl);
    await checkStorage(storage);

    if (command.action === 'check') {
      return { exitCode: 0, report: { code: 'STORAGE_READY', stage: 'connection' } };
    }

    await runPrismaMigration(command);

    return {
      exitCode: 0,
      report: {
        code: command.action === 'migrate' ? 'MIGRATIONS_APPLIED' : 'SCHEMA_CURRENT',
        stage: 'migration',
        migrations: await appliedMigrations(storage),
      },
    };
  } catch (error: unknown) {
    const safeError = error instanceof StorageError ? error : new StorageError('MIGRATION_FAILED', 'migration');
    const migration = safeError.code === 'MIGRATION_FAILED' ? await diagnoseFailedMigration(storage) : undefined;

    return { exitCode: 1, report: { code: safeError.code, stage: safeError.stage, migration } };
  } finally {
    await storage?.$disconnect();
  }
}
