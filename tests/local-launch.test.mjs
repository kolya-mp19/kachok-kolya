import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout } from 'node:timers/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

test('собранная оболочка и API запускаются без внешних сервисов', async () => {
  const server = spawn(process.execPath, ['dist/api/main.js'], {
    env: { ...process.env, PORT: '3017' },
    stdio: 'pipe',
  });
  let output = '';
  server.stdout.on('data', (data) => { output += data; });
  server.stderr.on('data', (data) => { output += data; });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      assert.equal(server.exitCode, null, output);
      try {
        const response = await fetch('http://127.0.0.1:3017/api/health');
        if (response.ok) { ready = true; break; }
      } catch { /* Сервер ещё запускается. */ }
      await setTimeout(100);
    }
    assert.ok(ready, output);
    const health = await fetch('http://127.0.0.1:3017/api/health');
    assert.deepEqual(await health.json(), { status: 'ok' });
    const page = await fetch('http://127.0.0.1:3017/', { headers: { Accept: 'text/html' } });
    assert.equal(page.status, 200);
    assert.match(await page.text(), /lang="ru"/);
    const unknownApi = await fetch('http://127.0.0.1:3017/api/missing', { headers: { Accept: 'text/html' } });
    assert.equal(unknownApi.status, 404);
    assert.match(unknownApi.headers.get('content-type'), /application\/json/);
  } finally {
    server.kill();
    await once(server, 'exit');
  }
});
