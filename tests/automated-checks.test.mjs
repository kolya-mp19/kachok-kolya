import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { getCheckEnvironment, parseCheckArguments, runStages, validateCleanupDirectory } from '../scripts/check-runner.mts';

test('обязательные этапы завершаются последовательно и дают отдельный наблюдаемый результат', async () => {
  const events = [];
  const executed = [];
  let finishInstallation;
  const installation = new Promise((resolveInstallation) => {
    finishInstallation = resolveInstallation;
  });
  const resultPromise = runStages(
    [
      {
        name: 'install',
        run: async () => {
          executed.push('install');
          await installation;
        },
      },
      {
        name: 'typecheck',
        run: async () => {
          executed.push('typecheck');
        },
      },
    ],
    (event) => events.push(event),
  );

  // Пока установка не закончилась, проверка типов не имеет готовых зависимостей.
  await Promise.resolve();
  assert.deepEqual(executed, ['install']);
  assert.deepEqual(
    events.map(({ stage, status }) => ({ stage, status })),
    [{ stage: 'install', status: 'started' }],
  );

  finishInstallation();
  assert.deepEqual(await resultPromise, { status: 'passed' });
  assert.deepEqual(executed, ['install', 'typecheck']);
  assert.deepEqual(
    events.map(({ stage, status }) => ({ stage, status })),
    [
      { stage: 'install', status: 'started' },
      { stage: 'install', status: 'passed' },
      { stage: 'typecheck', status: 'started' },
      { stage: 'typecheck', status: 'passed' },
    ],
  );
});

for (const failureMode of ['throw', 'reject']) {
  test(`ошибочный этап останавливает запуск без утечки исключения: ${failureMode}`, async () => {
    const secret = 'control_secret_database_password';
    const events = [];
    const executed = [];
    const result = await runStages(
      [
        { name: 'install', run: async () => executed.push('install') },
        {
          name: 'typecheck',
          run: () => {
            executed.push('typecheck');
            if (failureMode === 'throw') {
              throw new Error(secret);
            }
            return Promise.reject(new Error(secret));
          },
        },
        { name: 'build', run: async () => executed.push('build') },
        { name: 'test', run: async () => executed.push('test') },
      ],
      (event) => events.push(event),
    );

    assert.deepEqual(result, { status: 'failed', failedStage: 'typecheck' });
    assert.deepEqual(executed, ['install', 'typecheck']);
    assert.deepEqual(
      events.map(({ stage, status }) => ({ stage, status })),
      [
        { stage: 'install', status: 'started' },
        { stage: 'install', status: 'passed' },
        { stage: 'typecheck', status: 'started' },
        { stage: 'typecheck', status: 'failed' },
      ],
    );
    assert.equal(JSON.stringify({ result, events }).includes(secret), false);
  });
}

test('исправленный обязательный этап получает успех после неуспешного запуска', async () => {
  let hasTypeError = true;
  let builds = 0;
  const stages = [
    {
      name: 'typecheck',
      run: async () => {
        if (hasTypeError) {
          throw new Error('Контрольная ошибка типов');
        }
      },
    },
    {
      name: 'build',
      run: async () => {
        builds++;
      },
    },
  ];

  assert.deepEqual(await runStages(stages, () => {}), { status: 'failed', failedStage: 'typecheck' });
  assert.equal(builds, 0);
  hasTypeError = false;
  assert.deepEqual(await runStages(stages, () => {}), { status: 'passed' });
  assert.equal(builds, 1);
});

test('окружение проверки оставляет системные пути и исключает секреты и настройки автора', () => {
  const systemEnvironment = {
    PATH: 'synthetic-system-path',
    SystemRoot: 'C:\\Windows',
    TEMP: 'synthetic-temp',
    ProgramFiles: 'C:\\Program Files',
    'ProgramFiles(x86)': 'C:\\Program Files (x86)',
    ProgramW6432: 'C:\\Program Files',
    ProgramData: 'C:\\ProgramData',
  };
  const parentEnvironment = {
    ...systemEnvironment,
    DATABASE_URL: 'postgresql://personal:private@remote/personal',
    TEST_DATABASE_URL: 'postgresql://personal:private@remote/tests',
    NODE_OPTIONS: '--import=personal-instrumentation.mjs',
    NPM_TOKEN: 'private-npm-token',
    NPM_CONFIG_USERCONFIG: 'personal-npmrc',
    npm_config_registry: 'https://personal-registry.invalid',
    npm_execpath: 'personal-npm-cli.js',
    GITHUB_TOKEN: 'private-github-token',
    AWS_SECRET_ACCESS_KEY: 'private-cloud-key',
    SSH_AUTH_SOCK: 'personal-agent',
    SMTP_HOST: 'external-mail.invalid',
    SMTP_PASSWORD: 'private-mail-password',
    VITE_PRIVATE_KEY: 'private-browser-key',
    COMPOSE_FILE: 'personal-compose.yaml',
    COMPOSE_PROJECT_NAME: 'personal-production',
    DOCKER_HOST: 'tcp://remote-docker.invalid:2375',
    ARBITRARY_SECRET: 'unrecognized-private-value',
  };
  const environment = getCheckEnvironment(parentEnvironment);

  // Без ProgramFiles и ProgramData Docker на Windows теряет установленный Compose plugin.
  for (const [name, value] of Object.entries(systemEnvironment)) {
    assert.equal(environment[name], value, `Проверка потеряла системный каталог ${name}`);
  }
  for (const name of Object.keys(parentEnvironment).filter((name) => !Object.hasOwn(systemEnvironment, name))) {
    assert.equal(environment[name], undefined, `Проверка унаследовала ${name}`);
  }
  assert.equal(parentEnvironment.DATABASE_URL, 'postgresql://personal:private@remote/personal');
  assert.notEqual(environment, parentEnvironment);
  assert.equal(getCheckEnvironment({ Path: 'synthetic-windows-path' }).Path, 'synthetic-windows-path');
});

test('проверка выбирает HEAD по умолчанию либо явно указанный git ref', () => {
  assert.deepEqual(parseCheckArguments([]), { ref: 'HEAD' });
  assert.deepEqual(parseCheckArguments(['--ref', 'feature/local-checks']), { ref: 'feature/local-checks' });
  assert.deepEqual(parseCheckArguments(['--ref', 'HEAD~1']), { ref: 'HEAD~1' });
});

for (const arguments_ of [
  ['--unknown'],
  ['--ref'],
  ['--ref', ''],
  ['--ref', '--help'],
  ['--ref', 'HEAD\n--output=elsewhere'],
  ['HEAD'],
  ['--ref', 'HEAD', 'extra'],
]) {
  test(`некорректные аргументы отклоняются до запуска проверки: ${JSON.stringify(arguments_)}`, () => {
    assert.throws(() => parseCheckArguments(arguments_));
  });
}

test('очистка разрешена только для собственного вложенного каталога', () => {
  const root = resolve('.scratch/checks-owned');
  assert.doesNotThrow(() => validateCleanupDirectory(resolve(root, 'run-123'), root));

  // Сосед с тем же префиксом не принадлежит корню и не должен пройти startsWith-проверку.
  for (const directory of [root, resolve(root, '..'), resolve(root, '../checks-owned-other/run'), resolve(root, '../outside')]) {
    assert.throws(() => validateCleanupDirectory(directory, root));
  }
});
