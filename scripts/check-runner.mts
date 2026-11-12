import { isAbsolute, relative, resolve, sep } from 'node:path';

export type CheckStage = { name: string; run: () => Promise<void> };
export type CheckEvent = {
  stage: string;
  status: 'started' | 'passed' | 'failed';
  code?: 'CHECK_STAGE_FAILED';
};
export type CheckResult = { status: 'passed' | 'failed'; failedStage?: string };

/** Этапы выполняются последовательно; отказ запрещает запуск следующих этапов.
 * Исходное исключение намеренно не входит в публичный результат: оно может содержать секрет.
 */
export async function runStages(
  stages: readonly CheckStage[],
  onEvent: (event: CheckEvent) => void = () => {},
): Promise<CheckResult> {
  for (const stage of stages) {
    onEvent({ stage: stage.name, status: 'started' });
    try {
      await stage.run();
      onEvent({ stage: stage.name, status: 'passed' });
    } catch {
      onEvent({ stage: stage.name, status: 'failed', code: 'CHECK_STAGE_FAILED' });
      return { status: 'failed', failedStage: stage.name };
    }
  }
  return { status: 'passed' };
}

/** Передаёт системные пути, но не credentials, NODE_OPTIONS и настройки npm автора. */
export function getCheckEnvironment(parentEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const allowedNames = new Set([
    'path',
    'systemroot',
    'windir',
    'comspec',
    'pathext',
    'temp',
    'tmp',
    'home',
    'userprofile',
    'appdata',
    'localappdata',
    'systemdrive',
    // Docker CLI на Windows ищет системный Compose plugin через эти каталоги.
    'programfiles',
    'programfiles(x86)',
    'programw6432',
    'programdata',
    'lang',
    'lc_all',
  ]);
  const environment: NodeJS.ProcessEnv = {};
  for (const [name, value] of Object.entries(parentEnv)) {
    if (allowedNames.has(name.toLowerCase()) && value !== undefined) {
      environment[name] = value;
    }
  }
  return environment;
}

/** Принимает commit или tree-ish; рабочий каталог и индекс пользователя не меняются. */
export function parseCheckArguments(args: readonly string[]): { ref: string } {
  if (args.length === 0) {
    return { ref: 'HEAD' };
  }
  const ref = args[1];
  if (args.length !== 2 || args[0] !== '--ref' || !ref || ref.startsWith('-') || /[\x00-\x20\x7f]/u.test(ref)) {
    throw new Error('CHECK_ARGUMENTS_INVALID');
  }
  return { ref };
}

/** Разрешена очистка только дочернего каталога известного корня; корень удалять нельзя.
 * Проверка лексическая: перед реальным удалением вызывающий также проверяет realpath.
 */
export function validateCleanupDirectory(directory: string, root: string): void {
  const child = relative(resolve(root), resolve(directory));
  if (!child || child === '..' || child.startsWith('..' + sep) || isAbsolute(child)) {
    throw new Error('CHECK_CLEANUP_PATH_INVALID');
  }
}
