import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { once } from 'node:events';
import pg from 'pg';
import { withTestDatabase, runStorageCli } from './helpers/test-database.mjs';
import { startLocalServer } from './helpers/local-server.mjs';
import { launchBrowser } from './helpers/browser.mjs';
import { hashSecret, verifyPassword } from '../dist/api/auth/auth-secrets.js';
import { readAuthConfig } from '../dist/api/auth/auth.config.js';

const mailpit = process.env.TEST_MAILPIT_URL ?? 'http://127.0.0.1:8025';
const smtpPort = process.env.TEST_SMTP_PORT ?? '1025';
const password = 'проверочный пароль 12345';

function uniqueEmail() {
  return `registration-${randomUUID()}@example.test`;
}

async function findLink(email) {
  const search = await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`).then((response) =>
    response.json(),
  );
  assert.ok(search.messages.length > 0, 'SMTP-письмо должно быть видно в Mailpit');
  const message = await fetch(`${mailpit}/api/v1/message/${search.messages[0].ID}`).then((response) => response.json());
  assert.ok(!message.Text.includes(password));
  const link = /https?:\/\/[^\s]+#confirm=([A-Za-z0-9_-]{43})/.exec(message.Text);
  assert.ok(link, 'В письме должна быть ссылка подтверждения');
  return { link: link[0], token: link[1] };
}

async function attempt(origin) {
  const response = await fetch(`${origin}/api/auth/attempt`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const { csrfToken } = await response.json();
  return { cookie: response.headers.get('set-cookie').split(';')[0], csrfToken };
}

function post(origin, proof, route, body, overrides = {}) {
  return fetch(`${origin}/api/auth/${route}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
      Cookie: proof.cookie,
      'X-CSRF-Token': proof.csrfToken,
      ...overrides,
    },
    body: JSON.stringify(body),
  });
}

async function register(origin, proof, email) {
  const response = await post(origin, proof, 'registration', { name: 'Коля', email, password });
  assert.equal(response.status, 201, await response.clone().text());
  return response.json();
}

test('локальные профили не допускают LAN HTTP и внешнюю почту', () => {
  assert.throws(() => readAuthConfig({ APP_ORIGIN: 'http://192.168.1.10:5173' }), /AUTH_CONFIG_INVALID/);
  assert.throws(() => readAuthConfig({ SMTP_HOST: 'smtp.external.test' }), /AUTH_CONFIG_INVALID/);
  assert.equal(readAuthConfig({ APP_ORIGIN: 'https://192.168.1.10:5173' }).sessionCookie, '__Host-session');
});

test('регистрация по настоящему SMTP создаёт дневник только после защищённого подтверждения', { timeout: 180000 }, async (t) => {
  await withTestDatabase(async (databaseUrl) => {
    assert.equal(runStorageCli('migrate', databaseUrl).status, 0);
    const client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
    const origin = 'http://127.0.0.1:3021';
    const server = await startLocalServer({
      arguments_: ['dist/api/main.js'],
      port: 3021,
      healthPath: '/api/health',
      env: { DATABASE_URL: databaseUrl, APP_ORIGIN: origin, SMTP_PORT: smtpPort },
    });
    let browser;
    try {
      await t.test('неполный JSON не отражает пароль или токен в публичной диагностике', async () => {
        const secret = 'control-secret-' + randomUUID();
        const response = await fetch(origin + '/api/auth/registration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Origin: origin },
          body: `{"password":"${secret}",`,
        });
        assert.equal(response.status, 400);
        const text = await response.text();
        assert.ok(!text.includes(secret));
        assert.equal(JSON.parse(text).code, 'INVALID_REQUEST');
      });

      await t.test('запрос, доставка и GET не создают аккаунт; POST создаёт одного владельца, повтор не авторизует', async () => {
        const proof = await attempt(origin);
        const email = uniqueEmail();
        await register(origin, proof, email);
        assert.equal((await client.query('SELECT count(*)::int AS count FROM "Athlete"')).rows[0].count, 0);
        const { link, token } = await findLink(email);
        assert.ok(link.startsWith(origin + '/diary#confirm='));
        assert.equal((await fetch(link)).status, 200);
        assert.equal((await client.query('SELECT count(*)::int AS count FROM "Diary"')).rows[0].count, 0);
        const pending = (await client.query('SELECT * FROM "PendingEmailAction" WHERE "tokenHash" = $1', [hashSecret(token)]))
          .rows[0];
        assert.ok(pending.passwordHash.startsWith('$argon2id$'));
        assert.ok(await verifyPassword(password, pending.passwordHash));
        assert.notEqual(pending.tokenHash, token);
        const missingCsrf = await post(origin, proof, 'registration/confirm', { token }, { 'X-CSRF-Token': '' });
        assert.equal(missingCsrf.status, 403);
        const foreignOrigin = await post(origin, proof, 'registration/confirm', { token }, { Origin: 'http://external.test' });
        assert.equal(foreignOrigin.status, 403);
        const otherBrowser = await attempt(origin);
        assert.equal(
          (await post(origin, otherBrowser, 'registration/confirm', { token }, { 'X-CSRF-Token': proof.csrfToken })).status,
          403,
        );
        const confirmed = await post(origin, proof, 'registration/confirm', { token });
        assert.equal(confirmed.status, 201, await confirmed.clone().text());
        const identity = await confirmed.json();
        const cookie = confirmed.headers.get('set-cookie');
        assert.match(cookie, /^local-session=/);
        assert.match(cookie, /HttpOnly/);
        assert.match(cookie, /SameSite=Lax/);
        assert.doesNotMatch(cookie, /Domain=|Secure/);
        const reopened = await fetch(`${origin}/api/auth/session`, { headers: { Cookie: cookie.split(';')[0] } });
        assert.deepEqual(await reopened.json(), { athleteId: identity.athleteId, diaryId: identity.diaryId, name: 'Коля' });
        const replay = await post(origin, proof, 'registration/confirm', { token });
        assert.equal(replay.status, 400);
        assert.equal(replay.headers.get('set-cookie'), null);
        assert.equal((await client.query('SELECT count(*)::int AS count FROM "Diary"')).rows[0].count, 1);
        const session = (await client.query('SELECT * FROM "AuthSession" WHERE "athleteId" = $1', [identity.athleteId])).rows[0];
        assert.notEqual(session.tokenHash, cookie.split(';')[0].split('=')[1]);
        assert.equal(session.csrfHash, hashSecret(identity.csrfToken));
      });

      await t.test('разные письма одной нормализованной почты завершаются конкурентно без deadlock и дубликатов', async () => {
        const proof = await attempt(origin);
        const email = uniqueEmail();
        await register(origin, proof, email);
        const first = await findLink(email);
        await register(origin, proof, ` ${email.toUpperCase()} `);
        const second = await findLink(email);
        assert.notEqual(first.token, second.token);
        const responses = await Promise.all([
          post(origin, proof, 'registration/confirm', { token: first.token }),
          post(origin, proof, 'registration/confirm', { token: second.token }),
        ]);
        assert.deepEqual(responses.map((response) => response.status).sort(), [201, 400]);
        assert.equal(
          (await client.query('SELECT count(*)::int AS count FROM "Athlete" WHERE "normalizedEmail" = $1', [email])).rows[0]
            .count,
          1,
        );
        assert.equal(responses.filter((response) => response.headers.has('set-cookie')).length, 1);
      });

      await t.test('одна ссылка в двух одновременных POST выдаёт только одну сессию', async () => {
        const proof = await attempt(origin);
        const email = uniqueEmail();
        await register(origin, proof, email);
        const { token } = await findLink(email);
        const responses = await Promise.all([
          post(origin, proof, 'registration/confirm', { token }),
          post(origin, proof, 'registration/confirm', { token }),
        ]);
        assert.deepEqual(responses.map((response) => response.status).sort(), [201, 400]);
      });

      await t.test(
        'сбой создания дневника откатывает атлета, токен и сессию; подтверждение после исправления допустимо',
        async () => {
          const proof = await attempt(origin);
          const email = uniqueEmail();
          await register(origin, proof, email);
          const { token } = await findLink(email);
          await client.query('ALTER TABLE "Diary" ADD CONSTRAINT test_registration_failure CHECK (FALSE) NOT VALID');
          try {
            const failed = await post(origin, proof, 'registration/confirm', { token });
            assert.equal(failed.status, 503);
            assert.equal(failed.headers.get('set-cookie'), null);
            assert.equal(
              (await client.query('SELECT count(*)::int AS count FROM "Athlete" WHERE "normalizedEmail" = $1', [email])).rows[0]
                .count,
              0,
            );
            assert.equal(
              (await client.query('SELECT "consumedAt" FROM "PendingEmailAction" WHERE "tokenHash" = $1', [hashSecret(token)]))
                .rows[0].consumedAt,
              null,
            );
          } finally {
            await client.query('ALTER TABLE "Diary" DROP CONSTRAINT test_registration_failure');
          }
          assert.equal((await post(origin, proof, 'registration/confirm', { token })).status, 201);
        },
      );

      await t.test(
        'новое подтверждение ротирует сессию; отзыв, сроки и редакция доступа не допускают прежнюю cookie',
        async () => {
          const proof = await attempt(origin);
          let previousCookie = '';
          for (const reason of ['rotation', 'revoked', 'idle', 'absolute', 'revision']) {
            const email = uniqueEmail();
            await register(origin, proof, email);
            const { token } = await findLink(email);
            const confirmed = await post(
              origin,
              proof,
              'registration/confirm',
              { token },
              { Cookie: [proof.cookie, previousCookie].filter(Boolean).join('; ') },
            );
            assert.equal(confirmed.status, 201);
            if (previousCookie) {
              assert.equal((await fetch(origin + '/api/auth/session', { headers: { Cookie: previousCookie } })).status, 401);
            }
            const cookie = confirmed.headers.get('set-cookie').split(';')[0];
            const tokenHash = hashSecret(cookie.split('=')[1]);
            if (reason === 'revoked') {
              await client.query('UPDATE "AuthSession" SET "revokedAt" = now() WHERE "tokenHash" = $1', [tokenHash]);
            } else if (reason === 'idle') {
              await client.query(
                'UPDATE "AuthSession" SET "lastActiveAt" = now() - interval \'31 days\' WHERE "tokenHash" = $1',
                [tokenHash],
              );
            } else if (reason === 'absolute') {
              await client.query('UPDATE "AuthSession" SET "expiresAt" = now() - interval \'1 minute\' WHERE "tokenHash" = $1', [
                tokenHash,
              ]);
            } else if (reason === 'revision') {
              await client.query(
                'UPDATE "Athlete" SET "accessRevision" = "accessRevision" + 1 WHERE id = (SELECT "athleteId" FROM "AuthSession" WHERE "tokenHash" = $1)',
                [tokenHash],
              );
            }
            if (reason !== 'rotation') {
              assert.equal((await fetch(origin + '/api/auth/session', { headers: { Cookie: cookie } })).status, 401);
            }
            previousCookie = cookie;
          }
        },
      );

      await t.test(
        'просроченный, отменённый и чужого назначения токены не открывают дневник; повторная отправка меняет токен',
        async () => {
          const proof = await attempt(origin);
          for (const condition of ['expired', 'purpose', 'cancelled', 'resend']) {
            const email = uniqueEmail();
            const pending = await register(origin, proof, email);
            const { token } = await findLink(email);
            if (condition === 'expired') {
              await client.query('UPDATE "PendingEmailAction" SET "expiresAt" = now() - interval \'1 minute\' WHERE id = $1', [
                pending.pendingId,
              ]);
            } else if (condition === 'purpose') {
              await client.query('UPDATE "PendingEmailAction" SET purpose = \'recovery\' WHERE id = $1', [pending.pendingId]);
            } else if (condition === 'cancelled') {
              assert.equal((await post(origin, proof, 'registration/cancel', pending)).status, 201);
            } else {
              assert.equal((await post(origin, proof, 'registration/resend', pending)).status, 201);
              const next = await findLink(email);
              assert.notEqual(next.token, token);
              assert.equal((await post(origin, proof, 'registration/confirm', { token: next.token })).status, 201);
            }
            const invalid = await post(origin, proof, 'registration/confirm', { token });
            assert.equal(invalid.status, 400);
            assert.equal(invalid.headers.get('set-cookie'), null);
          }
        },
      );

      await t.test('лимит письма сохраняется в БД и снимается после окна, отмена чужого ожидания не действует', async () => {
        const proof = await attempt(origin);
        const other = await attempt(origin);
        const email = uniqueEmail();
        const pending = await register(origin, proof, email);
        await post(origin, other, 'registration/cancel', pending);
        assert.equal(
          (await client.query('SELECT "cancelledAt" FROM "PendingEmailAction" WHERE id = $1', [pending.pendingId])).rows[0]
            .cancelledAt,
          null,
        );
        const key = `mail:email:${hashSecret(email)}`;
        await client.query('UPDATE "AuthRateBucket" SET count = 5 WHERE key = $1', [key]);
        assert.equal((await post(origin, proof, 'registration/resend', pending)).status, 429);
        await client.query('UPDATE "AuthRateBucket" SET "windowStart" = now() - interval \'2 hours\' WHERE key = $1', [key]);
        assert.equal((await post(origin, proof, 'registration/resend', pending)).status, 201);
      });

      await t.test(
        'мобильная форма сохраняет ввод при отказе; ссылка очищается, подтверждение и перезагрузка открывают тот же дневник',
        async () => {
          browser = await launchBrowser();
          const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
          try {
            await page.goto(origin + '/diary');
            await page.getByRole('button', { name: 'Создать дневник', exact: true }).click();
            await page.getByLabel('Имя', { exact: true }).fill('Коля');
            const email = uniqueEmail();
            await page.getByLabel('Почта', { exact: true }).fill(email);
            await page.getByLabel('Пароль', { exact: true }).fill(password);
            await page.route('**/api/auth/registration', (route) =>
              route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'DELIVERY_FAILED' }) }),
            );
            await page.getByRole('button', { name: 'Отправить письмо', exact: true }).click();
            await page.getByRole('alert').waitFor();
            assert.equal(await page.getByLabel('Пароль', { exact: true }).inputValue(), password);
            await page.unroute('**/api/auth/registration');
            await page.getByRole('button', { name: 'Отправить письмо', exact: true }).click();
            await page.getByRole('heading', { name: 'Подтвердите почту' }).waitFor();
            const { link } = await findLink(email);
            await page.goto(link);
            await page.getByRole('button', { name: 'Подтвердить почту', exact: true }).waitFor();
            assert.equal(new URL(page.url()).hash, '');
            assert.equal(await page.locator('meta[name="referrer"]').getAttribute('content'), 'no-referrer');
            assert.equal(
              (await client.query('SELECT count(*)::int AS count FROM "Athlete" WHERE "normalizedEmail" = $1', [email])).rows[0]
                .count,
              0,
            );
            await page.getByRole('button', { name: 'Подтвердить почту', exact: true }).click();
            await page.getByRole('heading', { name: 'Ваш дневник пока пуст' }).waitFor();
            await page.reload();
            await page.getByRole('heading', { name: 'Ваш дневник пока пуст' }).waitFor();
            await page.evaluate(() => {
              document.documentElement.style.fontSize = '200%';
            });
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
            assert.equal(await page.getByRole('button', { name: 'Создать цикл' }).count(), 0);
          } finally {
            await page.close();
          }
        },
      );
    } finally {
      await browser?.close();
      await server.stop();
      await client.end();
    }
  });
});

test(
  'отказ SMTP и недоступный канал отменяют токены и не создают дневник; новый запрос допустим',
  { timeout: 60000 },
  async () => {
    await withTestDatabase(async (databaseUrl) => {
      assert.equal(runStorageCli('migrate', databaseUrl).status, 0);
      const client = new pg.Client({ connectionString: databaseUrl });
      await client.connect();
      const rejectingSmtp = createServer((socket) => {
        socket.write('220 synthetic SMTP\r\n');
        socket.on('data', (chunk) => {
          for (const line of chunk.toString().trim().split('\r\n')) {
            socket.write(line.startsWith('RCPT') ? '550 rejected\r\n' : '250 OK\r\n');
          }
        });
      });
      rejectingSmtp.listen(0, '127.0.0.1');
      await once(rejectingSmtp, 'listening');
      const origin = 'http://127.0.0.1:3040';
      let server;
      try {
        for (const port of [rejectingSmtp.address().port, 1]) {
          server = await startLocalServer({
            arguments_: ['dist/api/main.js'],
            port: 3040,
            healthPath: '/api/health',
            env: { DATABASE_URL: databaseUrl, APP_ORIGIN: origin, SMTP_PORT: String(port) },
          });
          const proof = await attempt(origin);
          const response = await post(origin, proof, 'registration', { name: 'Коля', email: uniqueEmail(), password });
          assert.equal(response.status, 503);
          assert.equal((await response.json()).code, 'DELIVERY_FAILED');
          assert.equal((await client.query('SELECT count(*)::int AS count FROM "Diary"')).rows[0].count, 0);
          assert.equal(
            (await client.query('SELECT count(*)::int AS count FROM "PendingEmailAction" WHERE "cancelledAt" IS NULL')).rows[0]
              .count,
            0,
          );
          await server.stop();
          server = undefined;
        }
        server = await startLocalServer({
          arguments_: ['dist/api/main.js'],
          port: 3040,
          healthPath: '/api/health',
          env: { DATABASE_URL: databaseUrl, APP_ORIGIN: origin, SMTP_PORT: smtpPort },
        });
        await register(origin, await attempt(origin), uniqueEmail());
      } finally {
        await server?.stop();
        await new Promise((resolve) => rejectingSmtp.close(resolve));
        await client.end();
      }
    });
  },
);
