import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { access, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCheckEnvironment, parseCheckArguments, runStages, validateCleanupDirectory } from './check-runner.mts';
import type { CheckEvent, CheckResult, CheckStage } from './check-runner.mts';

type CommandOptions = { cwd: string; env: NodeJS.ProcessEnv; capture?: boolean; signal?: AbortSignal };

function emit(event: CheckEvent | Record<string, unknown>): void {
  process.stdout.write(JSON.stringify(event) + '\n');
}

/** Без shell: ref и пути не становятся исполняемым текстом PowerShell/cmd. */
async function command(executable: string, args: string[], options: CommandOptions): Promise<string> {
  return await new Promise((resolveCommand, reject) => {
    if (options.signal?.aborted) {
      reject(new Error('CHECK_INTERRUPTED'));
      return;
    }
    const child = spawn(executable, args, {
      cwd: options.cwd,
      env: options.env,
      windowsHide: true,
      stdio: 'pipe',
    });
    const interrupt = (): void => {
      if (process.platform === 'win32' && child.pid) {
        // npm запускает tsc/test через дочерние процессы; kill только npm оставит
        // их писать в каталог, который cleanup уже собирается удалить.
        const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
          env: options.env,
          windowsHide: true,
          stdio: 'ignore',
        });
        killer.once('error', () => child.kill());
      } else {
        child.kill('SIGTERM');
      }
    };
    options.signal?.addEventListener('abort', interrupt, { once: true });
    let output = '';
    const diagnose = (chunk: Buffer): void => {
      // Даже синтетический URL не нужен в диагностике; настоящие значения окружения не наследуются.
      process.stderr.write(chunk.toString().replace(/postgres(?:ql)?:\/\/[^\s'"<>]+/giu, '[DATABASE_URL]'));
    };
    child.stdout.on('data', (chunk: Buffer) => {
      if (options.capture) {
        output += chunk.toString();
      } else {
        diagnose(chunk);
      }
    });
    child.stderr.on('data', diagnose);
    // close следует после error: cleanup не должен обгонять завершение процесса.
    let hasSpawnError = false;
    child.once('error', () => {
      hasSpawnError = true;
    });
    child.once('close', (exitCode) => {
      options.signal?.removeEventListener('abort', interrupt);
      if (exitCode === 0 && !hasSpawnError && !options.signal?.aborted) {
        resolveCommand(output.trim());
      } else {
        emit({ stage: 'command', status: 'failed', code: 'CHECK_COMMAND_FAILED', exitCode });
        reject(new Error('CHECK_COMMAND_FAILED'));
      }
    });
  });
}

async function findNpmCli(): Promise<string> {
  const candidates = [
    process.env.npm_execpath,
    join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
    resolve(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js'),
  ];
  for (const candidate of candidates) {
    if (candidate) {
      try {
        await access(candidate);
        return candidate;
      } catch {
        // Прямой node-запуск не задаёт npm_execpath; пробуем стандартные каталоги Node.
      }
    }
  }
  throw new Error('CHECK_NPM_UNAVAILABLE');
}

class LocalCheck {
  private readonly root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  private readonly scratchRoot = join(this.root, '.scratch');
  private readonly project = 'kachok-checks-' + randomUUID().replaceAll('-', '');
  private readonly env = getCheckEnvironment(process.env);
  private directory?: string;
  private source?: string;
  private tree?: string;
  private npmCli?: string;
  private hasDatabase = false;
  private readonly controller = new AbortController();

  async run(ref: string): Promise<CheckResult> {
    const stages: CheckStage[] = [
      { name: 'snapshot', run: () => this.snapshot(ref) },
      { name: 'install', run: () => this.npm(['ci']) },
      { name: 'browser', run: () => this.node(['node_modules/playwright/cli.js', 'install', 'chromium']) },
      { name: 'database', run: () => this.database() },
      { name: 'generate', run: () => this.npm(['run', 'db:generate']) },
      { name: 'format', run: () => this.npm(['run', 'format:check']) },
      { name: 'typecheck', run: () => this.npm(['run', 'typecheck']) },
      { name: 'build', run: () => this.npm(['run', 'build']) },
      { name: 'test', run: () => this.npm(['test']) },
    ];
    let result: CheckResult = { status: 'failed' };
    const interrupt = (): void => this.controller.abort();
    process.on('SIGINT', interrupt);
    process.on('SIGTERM', interrupt);
    try {
      result = await runStages(stages, emit);
    } finally {
      const cleanup = await runStages([{ name: 'cleanup', run: () => this.cleanup() }], emit);
      process.off('SIGINT', interrupt);
      process.off('SIGTERM', interrupt);
      if (cleanup.status === 'failed') {
        result = cleanup;
      }
    }
    emit({ stage: 'summary', ...result, source: this.source ?? null, tree: this.tree ?? null });
    return result;
  }

  private options(capture = false): CommandOptions {
    return {
      cwd: this.directory ? join(this.directory, 'source') : this.root,
      env: this.env,
      capture,
      signal: this.controller.signal,
    };
  }

  private async snapshot(ref: string): Promise<void> {
    // Archive учитывает core.autocrlf автора даже для git blobs с LF. Фиксируем
    // окончания строк, чтобы чистый снимок и результат Prettier не зависели от машины.
    const git = (args: string[]): Promise<string> =>
      command('git', ['-c', 'core.autocrlf=false', ...args], { cwd: this.root, env: this.env, capture: true });
    // Сначала разрешаем ref в OID: archive не получает пользовательские параметры git.
    this.source = await git(['rev-parse', '--verify', '--end-of-options', ref]);
    this.tree = await git(['rev-parse', '--verify', '--end-of-options', this.source + '^{tree}']);
    if (!/^[a-f0-9]{40,64}$/u.test(this.source) || !/^[a-f0-9]{40,64}$/u.test(this.tree)) {
      throw new Error('CHECK_SOURCE_INVALID');
    }
    const entries = await git(['ls-tree', '-r', '-z', this.tree]);
    for (const entry of entries.split('\0').filter(Boolean)) {
      const separator = entry.indexOf('\t');
      const path = entry.slice(separator + 1);
      const topLevel = path.split('/')[0];
      // Нельзя получить «чистую» проверку с прежней сборкой, локальными секретами
      // или ссылкой за пределы снимка даже при случайном добавлении этих файлов в git.
      if (
        entry.startsWith('120000 ') ||
        entry.startsWith('160000 ') ||
        ['node_modules', 'dist', '.git'].includes(topLevel) ||
        (topLevel.startsWith('.env') && topLevel !== '.env.example')
      ) {
        throw new Error('CHECK_SOURCE_CONTENT_INVALID');
      }
    }
    await mkdir(this.scratchRoot, { recursive: true });
    this.directory = await mkdtemp(join(this.scratchRoot, 'checks-'));
    await mkdir(join(this.directory, 'source'));
    const archive = join(this.directory, 'source.tar');
    await git(['archive', '--format=tar', '--output=' + archive, this.tree]);
    await command('tar', ['-xf', archive, '-C', join(this.directory, 'source')], { cwd: this.root, env: this.env });
    this.npmCli = await findNpmCli();
    // Даже системные пользовательские npmrc не должны добавлять registry credentials в проверку.
    const userNpmrc = join(this.directory, 'user.npmrc');
    const globalNpmrc = join(this.directory, 'global.npmrc');
    await writeFile(userNpmrc, '');
    await writeFile(globalNpmrc, '');
    this.env.npm_config_userconfig = userNpmrc;
    this.env.npm_config_globalconfig = globalNpmrc;
    this.env.npm_config_audit = 'false';
    this.env.npm_config_fund = 'false';
    this.env.npm_config_update_notifier = 'false';
    this.env.npm_config_engine_strict = 'true';
    // Playwright использует общий пользовательский кэш с версиями браузеров:
    // повторный запуск скачивает только отсутствующую версию и не удаляет кэш.
    emit({ stage: 'source', status: 'passed', source: this.source, tree: this.tree });
  }

  private async node(args: string[]): Promise<void> {
    await command(process.execPath, args, this.options());
  }

  private async npm(args: string[]): Promise<void> {
    if (!this.npmCli) {
      throw new Error('CHECK_NPM_UNAVAILABLE');
    }
    await this.node([this.npmCli, ...args]);
  }

  private async database(): Promise<void> {
    const context = await command('docker', ['context', 'show'], this.options(true));
    if (!context || context.startsWith('-') || /[\x00-\x20]/u.test(context)) {
      throw new Error('CHECK_DOCKER_CONTEXT_INVALID');
    }
    const endpointJson = await command(
      'docker',
      ['context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}', context],
      this.options(true),
    );
    const endpoint: unknown = JSON.parse(endpointJson);
    if (typeof endpoint !== 'string' || (!endpoint.startsWith('unix:///') && !endpoint.startsWith('npipe:////./pipe/'))) {
      throw new Error('CHECK_DOCKER_MUST_BE_LOCAL');
    }
    // Фиксируем проверенный endpoint и для Compose, вызываемого внутри тестов.
    // В отличие от имени context он не может переключиться на удалённый хост.
    this.env.DOCKER_HOST = endpoint;
    this.env.COMPOSE_FILE = join(this.options().cwd, 'compose.checks.yaml');
    this.env.COMPOSE_PROJECT_NAME = this.project;
    // Запуск может создать контейнер до отказа ожидания; cleanup обязателен с этого момента.
    this.hasDatabase = true;
    await command('docker', ['compose', 'up', '-d', '--wait', '--wait-timeout', '90', 'postgres'], this.options());
    const binding = await command('docker', ['compose', 'port', 'postgres', '5432'], this.options(true));
    const match = /^127\.0\.0\.1:(\d+)$/u.exec(binding);
    if (!match) {
      throw new Error('CHECK_DATABASE_PORT_INVALID');
    }
    this.env.TEST_DATABASE_URL = `postgresql://checks:synthetic-checks-only@127.0.0.1:${match[1]}/checks`;
    this.env.DATABASE_URL = this.env.TEST_DATABASE_URL;
  }

  private async cleanup(): Promise<void> {
    // При отказе down оставляем файлы Compose для безопасной повторной ручной очистки.
    if (this.hasDatabase) {
      // Уже прерванный основной запуск не должен отменить освобождение его ресурсов.
      const options = this.options();
      delete options.signal;
      await command('docker', ['compose', 'down', '--volumes', '--remove-orphans'], options);
      this.hasDatabase = false;
    }
    if (this.directory) {
      validateCleanupDirectory(this.directory, this.scratchRoot);
      validateCleanupDirectory(await realpath(this.directory), await realpath(this.scratchRoot));
      await rm(this.directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    }
  }
}

try {
  const { ref } = parseCheckArguments(process.argv.slice(2));
  const result = await new LocalCheck().run(ref);
  process.exitCode = result.status === 'passed' ? 0 : 1;
} catch {
  emit({ stage: 'summary', status: 'failed', code: 'CHECK_CONFIGURATION_FAILED' });
  process.exitCode = 1;
}
