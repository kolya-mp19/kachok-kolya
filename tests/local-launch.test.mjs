import { startLocalServer } from './helpers/local-server.mjs';
import { removeTestDirectory } from './helpers/test-directory.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('собранная оболочка и API запускаются без внешних сервисов', { timeout: 15000 }, async () => {
  // Путь checkout может содержать скрытый каталог; это не скрытые файлы сайта.
  const checkout = await mkdtemp(join(tmpdir(), '.kachok-launch-'));
  await cp(resolve('dist/web'), join(checkout, 'dist/web'), { recursive: true });
  const server = await startLocalServer({
    arguments_: [resolve('dist/api/main.js')],
    cwd: checkout,
    port: 3017,
    healthPath: '/api/health',
  });
  try {
    const health = await fetch('http://127.0.0.1:3017/api/health');
    assert.deepEqual(await health.json(), { status: 'ok' });
    const page = await fetch('http://127.0.0.1:3017/', { headers: { Accept: 'text/html' } });
    assert.equal(page.status, 200);
    assert.match(await page.text(), /lang="ru"/);
    for (const path of ['/calculator', '/calculator/', '/diary', '/diary/']) {
      const entry = await fetch(`http://127.0.0.1:3017${path}`, { headers: { Accept: 'text/html' } });
      assert.equal(entry.status, 200, path);
      assert.match(await entry.text(), /lang="ru"/, path);
    }
    const unknownApi = await fetch('http://127.0.0.1:3017/api/missing', { headers: { Accept: 'text/html' } });
    assert.equal(unknownApi.status, 404);
    assert.match(unknownApi.headers.get('content-type'), /application\/json/);
  } finally {
    await server.stop();
    await removeTestDirectory(checkout, tmpdir());
  }
});
