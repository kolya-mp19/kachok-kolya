import { runStorageCommand } from './storage-command.mjs';

try {
  const result = await runStorageCommand(process.argv.slice(2), process.env.DATABASE_URL);
  const output = result.exitCode === 0 ? process.stdout : process.stderr;

  output.write(JSON.stringify(result.report) + '\n');
  process.exitCode = result.exitCode;
} catch {
  // Даже отказ закрытия соединения не должен вывести исходное исключение драйвера.
  process.stderr.write(JSON.stringify({ code: 'MIGRATION_FAILED', stage: 'migration' }) + '\n');
  process.exitCode = 1;
}
