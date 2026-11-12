import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import pg from 'pg';
import { withTestDatabase, runStorageCli } from './helpers/test-database.mjs';
import { startLocalServer } from './helpers/local-server.mjs';
import { launchBrowser } from './helpers/browser.mjs';
import { hashPassword, hashSecret, verifyPassword } from '../dist/api/auth/auth-secrets.js';

const oldPassword = 'прежний пароль дневника 123';
const newPassword = 'новый пароль дневника 456';
const mailpit = process.env.TEST_MAILPIT_URL ?? 'http://127.0.0.1:8025';
const smtpPort = process.env.TEST_SMTP_PORT ?? '1025';

async function attempt(origin) {
  const response = await fetch(`${origin}/api/auth/attempt`);
  assert.equal(response.status, 200);
  return { cookie: response.headers.get('set-cookie').split(';')[0], csrfToken: (await response.json()).csrfToken };
}

function post(origin, proof, route, body, headers = {}) {
  return fetch(`${origin}/api/auth/${route}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
      Cookie: proof.cookie,
      'X-CSRF-Token': proof.csrfToken,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function requestRecovery(origin, proof, email) {
  const response = await post(origin, proof, 'recovery', { email });
  assert.equal(response.status, 201, await response.clone().text());
  const result = await response.json();
  assert.equal(result.status, 'accepted');
  assert.deepEqual(Object.keys(result).sort(), ['pendingId', 'status']);
  return result;
}

async function messages(email) {
  return (await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`).then((response) => response.json()))
    .messages;
}

async function findLink(email) {
  const found = await messages(email);
  assert.ok(found.length);
  const message = await fetch(`${mailpit}/api/v1/message/${found[0].ID}`).then((response) => response.json());
  assert.ok(!message.Text.includes(oldPassword) && !message.Text.includes(newPassword));
  const matched = /https?:\/\/[^\s]+#recover=([A-Za-z0-9_-]{43})/.exec(message.Text);
  assert.ok(matched);
  return { link: matched[0], token: matched[1] };
}

async function createAccount(client, passwordHash) {
  const account = { athleteId: randomUUID(), diaryId: randomUUID(), email: `recover-${randomUUID()}@example.test` };
  await client.query('INSERT INTO "Athlete" (id,name,email,"normalizedEmail","passwordHash") VALUES ($1,$2,$3,$3,$4)', [
    account.athleteId,
    'Коля',
    account.email,
    passwordHash,
  ]);
  await client.query('INSERT INTO "Diary" (id,"athleteId") VALUES ($1,$2)', [account.diaryId, account.athleteId]);
  return account;
}

test('восстановление меняет только подтверждённый пароль прежнего дневника', { timeout: 180000 }, async (t) => {
  await withTestDatabase(async (databaseUrl) => {
    assert.equal(runStorageCli('migrate', databaseUrl).status, 0);
    const client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
    const origin = 'http://127.0.0.1:3042';
    const server = await startLocalServer({
      arguments_: ['dist/api/main.js'],
      port: 3042,
      healthPath: '/api/health',
      env: { DATABASE_URL: databaseUrl, APP_ORIGIN: origin, SMTP_PORT: smtpPort },
    });
    const encoded = await hashPassword(oldPassword);
    let browser;
    try {
      await t.test('запрос одинаков для известной и неизвестной почты, не меняет доступ; GET не потребляет токен', async () => {
        const account = await createAccount(client, encoded);
        const proof = await attempt(origin);
        const before = (await client.query('SELECT * FROM "Athlete" WHERE id=$1', [account.athleteId])).rows[0];
        const known = await requestRecovery(origin, proof, ` ${account.email.toUpperCase()} `);
        const unknownEmail = `unknown-${randomUUID()}@example.test`;
        const unknown = await requestRecovery(origin, proof, unknownEmail);
        assert.deepEqual(Object.keys(known), Object.keys(unknown));
        assert.equal((await messages(unknownEmail)).length, 0);
        assert.deepEqual((await client.query('SELECT * FROM "Athlete" WHERE id=$1', [account.athleteId])).rows[0], before);
        const { link, token } = await findLink(account.email);
        assert.ok(link.startsWith(origin + '/diary#recover='));
        assert.equal((await fetch(link)).status, 200);
        const stored = (await client.query('SELECT * FROM "PasswordRecovery" WHERE id=$1', [known.pendingId])).rows[0];
        assert.equal(stored.tokenHash, hashSecret(token));
        assert.equal(stored.purpose, 'recovery');
        assert.equal(stored.consumedAt, null);
        assert.ok(stored.deliveredAt);
        assert.ok(stored.expiresAt - stored.createdAt > 29 * 60000 && stored.expiresAt - stored.createdAt <= 30 * 60000);
        assert.equal(
          (await client.query('SELECT count(*)::int count FROM "Diary" WHERE "athleteId"=$1', [account.athleteId])).rows[0].count,
          1,
        );
      });

      await t.test(
        'POST сохраняет diaryId и записи, отзывает все сессии/письма; только новый пароль открывает тот же дневник',
        async () => {
          const account = await createAccount(client, encoded);
          const proof = await attempt(origin);
          const sessions = [];
          for (let index = 0; index < 2; index++) {
            const login = await post(origin, proof, 'login', { email: account.email, password: oldPassword });
            assert.equal(login.status, 201);
            sessions.push(login.headers.get('set-cookie').split(';')[0]);
          }
          const operationId = randomUUID();
          await client.query(
            'INSERT INTO "OperationReceipt" ("athleteId","operationId","recoveryGeneration","commandHash",revision,result) VALUES ($1,$2,$3,$4,$5,$6)',
            [account.athleteId, operationId, 'generation', 'synthetic', '1', JSON.stringify({ note: 'проверочная запись' })],
          );
          const beforeReceipts = (
            await client.query('SELECT * FROM "OperationReceipt" WHERE "athleteId"=$1', [account.athleteId])
          ).rows;
          await requestRecovery(origin, proof, account.email);
          const first = await findLink(account.email);
          await requestRecovery(origin, proof, account.email);
          const second = await findLink(account.email);
          const reset = await post(origin, proof, 'recovery/confirm', { token: first.token, password: newPassword });
          assert.equal(reset.status, 201, await reset.clone().text());
          assert.deepEqual(await reset.json(), { status: 'reset' });
          assert.match(reset.headers.get('set-cookie'), /^local-session=;/);
          for (const cookie of sessions) {
            assert.equal((await fetch(origin + '/api/auth/session', { headers: { Cookie: cookie } })).status, 401);
          }
          assert.equal(
            (await post(origin, proof, 'recovery/confirm', { token: first.token, password: oldPassword })).status,
            400,
          );
          assert.equal(
            (await post(origin, proof, 'recovery/confirm', { token: second.token, password: oldPassword })).status,
            400,
          );
          assert.equal((await post(origin, proof, 'login', { email: account.email, password: oldPassword })).status, 401);
          const login = await post(origin, proof, 'login', { email: account.email, password: newPassword });
          const identity = await login.json();
          assert.equal(login.status, 201);
          assert.equal(identity.athleteId, account.athleteId);
          assert.equal(identity.diaryId, account.diaryId);
          assert.deepEqual(
            (await client.query('SELECT * FROM "OperationReceipt" WHERE "athleteId"=$1', [account.athleteId])).rows,
            beforeReceipts,
          );
          assert.equal(
            (await client.query('SELECT "accessRevision" FROM "Athlete" WHERE id=$1', [account.athleteId])).rows[0]
              .accessRevision,
            2,
          );
        },
      );

      await t.test('отсутствующий после восстановления БД хеш восстанавливается только новым письмом', async () => {
        const account = await createAccount(client, null);
        const proof = await attempt(origin);
        assert.equal((await post(origin, proof, 'login', { email: account.email, password: oldPassword })).status, 401);
        await requestRecovery(origin, proof, account.email);
        const { token } = await findLink(account.email);
        assert.equal(
          (await client.query('SELECT "passwordHash" FROM "Athlete" WHERE id=$1', [account.athleteId])).rows[0].passwordHash,
          null,
        );
        assert.equal((await post(origin, proof, 'recovery/confirm', { token, password: newPassword })).status, 201);
        const login = await post(origin, proof, 'login', { email: account.email, password: newPassword });
        assert.equal((await login.json()).diaryId, account.diaryId);
        assert.equal((await post(origin, proof, 'recovery/confirm', { token, password: oldPassword })).status, 400);
      });

      await t.test('непригодные токены, отмена, чужой CSRF/Origin и неверное назначение не меняют пароль', async () => {
        const proof = await attempt(origin);
        for (const condition of ['expired', 'purpose', 'cancelled', 'csrf', 'origin', 'wrong']) {
          const account = await createAccount(client, encoded);
          const pending = await requestRecovery(origin, proof, account.email);
          const { token } = await findLink(account.email);
          if (condition === 'expired') {
            await client.query('UPDATE "PasswordRecovery" SET "expiresAt"=now()-interval \'1 minute\' WHERE id=$1', [
              pending.pendingId,
            ]);
          } else if (condition === 'purpose') {
            await client.query('UPDATE "PasswordRecovery" SET purpose=\'registration\' WHERE id=$1', [pending.pendingId]);
          } else if (condition === 'cancelled') {
            assert.equal((await post(origin, proof, 'recovery/cancel', pending)).status, 201);
            assert.equal((await post(origin, proof, 'recovery/resend', pending)).status, 400);
          }
          const headers =
            condition === 'csrf' ? { 'X-CSRF-Token': '' } : condition === 'origin' ? { Origin: 'https://foreign.test' } : {};
          const response = await post(
            origin,
            proof,
            'recovery/confirm',
            { token: condition === 'wrong' ? 'x'.repeat(43) : token, password: newPassword },
            headers,
          );
          assert.equal(response.status, ['csrf', 'origin'].includes(condition) ? 403 : 400);
          assert.equal(response.headers.get('set-cookie'), null);
          assert.equal(
            (await client.query('SELECT "passwordHash" FROM "Athlete" WHERE id=$1', [account.athleteId])).rows[0].passwordHash,
            encoded,
          );
        }
        // Токен регистрации не становится восстановлением через другой HTTP-маршрут.
        const email = `register-${randomUUID()}@example.test`;
        const registered = await post(origin, proof, 'registration', { name: 'Коля', email, password: oldPassword });
        assert.equal(registered.status, 201);
        const found = await messages(email);
        const message = await fetch(`${mailpit}/api/v1/message/${found[0].ID}`).then((response) => response.json());
        const token = /#confirm=([A-Za-z0-9_-]{43})/.exec(message.Text)[1];
        assert.equal((await post(origin, proof, 'recovery/confirm', { token, password: newPassword })).status, 400);
      });

      await t.test('разные ссылки и одна ссылка подтверждаются конкурентно без deadlock и второй смены', async () => {
        const proof = await attempt(origin);
        for (const sameToken of [false, true]) {
          const account = await createAccount(client, encoded);
          await requestRecovery(origin, proof, account.email);
          const first = await findLink(account.email);
          await requestRecovery(origin, proof, account.email);
          const second = await findLink(account.email);
          const responses = await Promise.all([
            post(origin, proof, 'recovery/confirm', { token: first.token, password: newPassword }),
            post(origin, proof, 'recovery/confirm', { token: sameToken ? first.token : second.token, password: newPassword }),
          ]);
          assert.deepEqual(responses.map((response) => response.status).sort(), [201, 400]);
          assert.equal(
            (await client.query('SELECT "accessRevision" FROM "Athlete" WHERE id=$1', [account.athleteId])).rows[0]
              .accessRevision,
            2,
          );
        }
      });

      await t.test('одновременный вход старым паролем не оставляет действующую сессию после reset', async () => {
        const account = await createAccount(client, encoded);
        const proof = await attempt(origin);
        await requestRecovery(origin, proof, account.email);
        const { token } = await findLink(account.email);
        const blocker = new pg.Client({ connectionString: databaseUrl });
        await blocker.connect();
        let login;
        let reset;
        try {
          await blocker.query('BEGIN');
          await blocker.query('SELECT id FROM "Athlete" WHERE id=$1 FOR UPDATE', [account.athleteId]);
          login = post(origin, proof, 'login', { email: account.email, password: oldPassword });
          reset = post(origin, proof, 'recovery/confirm', { token, password: newPassword });
          let waiting = false;
          for (let index = 0; index < 100; index++) {
            const locks = await client.query(
              "SELECT count(*)::int count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%FROM \"Athlete\"%FOR UPDATE%'",
            );
            if (locks.rows[0].count >= 2) {
              waiting = true;
              break;
            }
            await setTimeout(25);
          }
          assert.ok(waiting, 'Оба действия должны ждать одной блокировки владельца');
          await blocker.query('COMMIT');
          const [loginResponse, resetResponse] = await Promise.all([login, reset]);
          assert.equal(resetResponse.status, 201);
          assert.ok([201, 401].includes(loginResponse.status));
          if (loginResponse.status === 201) {
            assert.equal(
              (
                await fetch(origin + '/api/auth/session', {
                  headers: { Cookie: loginResponse.headers.get('set-cookie').split(';')[0] },
                })
              ).status,
              401,
            );
          }
        } finally {
          await blocker.query('ROLLBACK');
          await blocker.end();
          await Promise.allSettled([login, reset]);
        }
      });

      await t.test('сбой отзыва сессий откатывает пароль, редакцию и потребление токена', async () => {
        const account = await createAccount(client, encoded);
        const proof = await attempt(origin);
        await post(origin, proof, 'login', { email: account.email, password: oldPassword });
        await requestRecovery(origin, proof, account.email);
        const { token } = await findLink(account.email);
        await client.query(
          "CREATE FUNCTION reject_recovery_revoke() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic rollback'; END $$",
        );
        await client.query(
          'CREATE TRIGGER reject_recovery_revoke BEFORE UPDATE ON "AuthSession" FOR EACH ROW EXECUTE FUNCTION reject_recovery_revoke()',
        );
        try {
          const response = await post(origin, proof, 'recovery/confirm', { token, password: newPassword });
          assert.equal(response.status, 503);
          assert.ok(!(await response.text()).includes(token));
          const athlete = (
            await client.query('SELECT "passwordHash","accessRevision" FROM "Athlete" WHERE id=$1', [account.athleteId])
          ).rows[0];
          assert.deepEqual(athlete, { passwordHash: encoded, accessRevision: 1 });
          assert.equal(
            (await client.query('SELECT "consumedAt" FROM "PasswordRecovery" WHERE "tokenHash"=$1', [hashSecret(token)])).rows[0]
              .consumedAt,
            null,
          );
        } finally {
          await client.query('DROP TRIGGER reject_recovery_revoke ON "AuthSession"');
          await client.query('DROP FUNCTION reject_recovery_revoke()');
        }
        assert.equal((await post(origin, proof, 'recovery/confirm', { token, password: newPassword })).status, 201);
      });

      await t.test('повтор письма и отмена ограничены исходной попыткой, лимит снимается после окна', async () => {
        const account = await createAccount(client, encoded);
        const proof = await attempt(origin);
        const other = await attempt(origin);
        const pending = await requestRecovery(origin, proof, account.email);
        await post(origin, other, 'recovery/cancel', pending);
        assert.equal(
          (await client.query('SELECT "cancelledAt" FROM "PasswordRecovery" WHERE id=$1', [pending.pendingId])).rows[0]
            .cancelledAt,
          null,
        );
        assert.equal((await post(origin, other, 'recovery/resend', pending)).status, 400);
        assert.equal((await post(origin, proof, 'recovery/resend', pending)).status, 201);
        const key = `recovery-mail:email:${hashSecret(account.email)}`;
        await client.query('UPDATE "AuthRateBucket" SET count=5 WHERE key=$1', [key]);
        assert.equal((await post(origin, proof, 'recovery/resend', pending)).status, 429);
        await client.query('UPDATE "AuthRateBucket" SET "windowStart"=now()-interval \'2 hours\' WHERE key=$1', [key]);
        assert.equal((await post(origin, proof, 'recovery/resend', pending)).status, 201);
      });

      await t.test(
        'мобильный поток очищает ссылку, сохраняет пароль при отказе и требует обычного входа после reset',
        async () => {
          const account = await createAccount(client, encoded);
          browser = await launchBrowser();
          const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
          try {
            await page.goto(origin + '/diary');
            await page.getByRole('button', { name: 'Забыли пароль', exact: true }).click();
            await page.getByLabel('Почта', { exact: true }).fill(account.email);
            await page.getByRole('button', { name: 'Отправить письмо', exact: true }).click();
            await page.getByRole('heading', { name: 'Запрос принят' }).waitFor();
            const cancelled = await findLink(account.email);
            await page.getByRole('button', { name: 'Отменить восстановление', exact: true }).click();
            await page.getByRole('heading', { name: 'Вход по почте' }).waitFor();
            assert.ok(
              (
                await client.query('SELECT "cancelledAt" FROM "PasswordRecovery" WHERE "tokenHash"=$1', [
                  hashSecret(cancelled.token),
                ])
              ).rows[0].cancelledAt,
            );
            assert.equal(
              (await post(origin, await attempt(origin), 'recovery/confirm', { token: cancelled.token, password: newPassword }))
                .status,
              400,
            );
            await page.getByRole('button', { name: 'Забыли пароль', exact: true }).click();
            await page.getByLabel('Почта', { exact: true }).fill(account.email);
            await page.getByRole('button', { name: 'Отправить письмо', exact: true }).click();
            await page.getByRole('heading', { name: 'Запрос принят' }).waitFor();
            const { link } = await findLink(account.email);
            await page.goto(link);
            await page.getByRole('heading', { name: 'Новый пароль', exact: true }).waitFor();
            await page.getByRole('button', { name: 'Отменить восстановление', exact: true }).click();
            await page.getByRole('heading', { name: 'Восстановление доступа', exact: true }).waitFor();
            assert.equal(
              (await client.query('SELECT "passwordHash" FROM "Athlete" WHERE id=$1', [account.athleteId])).rows[0].passwordHash,
              encoded,
            );
            await page.goto(link);
            await page.getByRole('heading', { name: 'Новый пароль', exact: true }).waitFor();
            assert.equal(new URL(page.url()).hash, '');
            await page.getByLabel('Новый пароль', { exact: true }).fill(newPassword);
            await page.route('**/api/auth/recovery/confirm', (route) =>
              route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'AUTH_UNAVAILABLE' }) }),
            );
            const failedConfirmation = page.waitForResponse(
              (response) => response.url().endsWith('/api/auth/recovery/confirm') && response.status() === 503,
            );
            await page.getByRole('button', { name: 'Установить пароль', exact: true }).click();
            await failedConfirmation;
            await page.getByRole('alert').waitFor();
            assert.equal(await page.getByLabel('Новый пароль', { exact: true }).inputValue(), newPassword);
            await page.unroute('**/api/auth/recovery/confirm');
            await page.evaluate(() => {
              document.documentElement.style.fontSize = '200%';
            });
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
            await mkdir('.scratch/e009', { recursive: true });
            await page.screenshot({ path: '.scratch/e009/t003-recovery-320.png', fullPage: true });
            await page
              .getByRole('button', { name: 'Установить пароль', exact: true })
              .click({ timeout: 5000 })
              .catch(async () => {
                throw new Error(
                  JSON.stringify({
                    headings: await page.locator('h2').allTextContents(),
                    buttons: await page.getByRole('button').allTextContents(),
                  }),
                );
              });
            await page.getByRole('heading', { name: 'Пароль установлен' }).waitFor();
            assert.equal((await page.request.get(origin + '/api/auth/session')).status(), 401);
            await page.getByRole('button', { name: 'Войти', exact: true }).click();
            await page.getByLabel('Почта', { exact: true }).fill(account.email);
            await page.getByLabel('Пароль', { exact: true }).fill(newPassword);
            await page.getByRole('button', { name: 'Войти', exact: true }).click();
            await page.getByRole('heading', { name: 'Ваш дневник пока пуст' }).waitFor();
            assert.equal(
              (await page.request.get(origin + '/api/auth/session').then((response) => response.json())).diaryId,
              account.diaryId,
            );
          } finally {
            await page.close();
          }
        },
      );
      await t.test('ответ прежней ссылки не заменяет новый экран после hashchange', async () => {
        const firstAccount = await createAccount(client, encoded);
        const secondAccount = await createAccount(client, encoded);
        const proof = await attempt(origin);
        await requestRecovery(origin, proof, firstAccount.email);
        const first = await findLink(firstAccount.email);
        await requestRecovery(origin, proof, secondAccount.email);
        const second = await findLink(secondAccount.email);
        browser ??= await launchBrowser();
        const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
        let release;
        const held = new Promise((resolve) => {
          release = resolve;
        });
        let started;
        const inFlight = new Promise((resolve) => {
          started = resolve;
        });
        try {
          await page.goto(first.link);
          await page.getByLabel('Новый пароль', { exact: true }).fill(newPassword);
          await page.route('**/api/auth/recovery/confirm', async (route) => {
            started();
            await held;
            await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ status: 'reset' }) });
          });
          await page.getByRole('button', { name: 'Установить пароль', exact: true }).click();
          await inFlight;
          await page.evaluate((token) => {
            window.location.hash = `recover=${token}`;
          }, second.token);
          await page.waitForFunction(() => window.location.hash === '');
          assert.equal(await page.getByLabel('Новый пароль', { exact: true }).inputValue(), '');
          release();
          await page.waitForFunction(() => !document.querySelector('button[type="submit"]')?.disabled);
          await page.unroute('**/api/auth/recovery/confirm');
          assert.equal(await page.getByRole('heading', { name: 'Пароль установлен', exact: true }).count(), 0);
          await page.getByLabel('Новый пароль', { exact: true }).fill(newPassword);
          await page.getByRole('button', { name: 'Установить пароль', exact: true }).click();
          await page.getByRole('heading', { name: 'Пароль установлен', exact: true }).waitFor();
          assert.equal(
            (await client.query('SELECT "passwordHash" FROM "Athlete" WHERE id=$1', [firstAccount.athleteId])).rows[0]
              .passwordHash,
            encoded,
          );
          assert.ok(
            await verifyPassword(
              newPassword,
              (await client.query('SELECT "passwordHash" FROM "Athlete" WHERE id=$1', [secondAccount.athleteId])).rows[0]
                .passwordHash,
            ),
          );
        } finally {
          release();
          await page.close();
        }
      });

      await t.test(
        'истёкшее доказательство формы обновляется только по следующей явной попытке без потери токена и пароля',
        async () => {
          const account = await createAccount(client, encoded);
          browser ??= await launchBrowser();
          const context = await browser.newContext();
          const page = await context.newPage();
          try {
            await page.goto(origin + '/diary');
            await page.getByRole('button', { name: 'Забыли пароль', exact: true }).click();
            await page.getByLabel('Почта', { exact: true }).fill(account.email);
            await page.getByRole('button', { name: 'Отправить письмо', exact: true }).click();
            await page.getByRole('heading', { name: 'Запрос принят', exact: true }).waitFor();
            const { link } = await findLink(account.email);
            await page.goto(link);
            await page.getByLabel('Новый пароль', { exact: true }).fill(newPassword);
            // Исходный CSRF уже закэширован запросом письма в этой же вкладке.
            const cookie = (await context.cookies()).find((value) => value.name === 'local-attempt');
            assert.ok(cookie);
            await client.query('UPDATE "AuthAttempt" SET "expiresAt"=now()-interval \'1 minute\' WHERE "tokenHash"=$1', [
              hashSecret(cookie.value),
            ]);
            await page.getByRole('button', { name: 'Установить пароль', exact: true }).click();
            await page.getByRole('alert').waitFor();
            assert.equal(await page.getByLabel('Новый пароль', { exact: true }).inputValue(), newPassword);
            assert.equal(
              (await client.query('SELECT "passwordHash" FROM "Athlete" WHERE id=$1', [account.athleteId])).rows[0].passwordHash,
              encoded,
            );
            await page.getByRole('button', { name: 'Установить пароль', exact: true }).click();
            await page.getByRole('heading', { name: 'Пароль установлен', exact: true }).waitFor();
          } finally {
            await context.close();
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
  'SMTP reject и недоступность сохраняют доступ, дают нейтральный запрос и проверяемый отказ доставки',
  { timeout: 60000 },
  async () => {
    await withTestDatabase(async (databaseUrl) => {
      assert.equal(runStorageCli('migrate', databaseUrl).status, 0);
      const client = new pg.Client({ connectionString: databaseUrl });
      await client.connect();
      const encoded = await hashPassword(oldPassword);
      const account = await createAccount(client, encoded);
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
      const origin = 'http://127.0.0.1:3043';
      let server;
      try {
        for (const port of [rejectingSmtp.address().port, 1]) {
          server = await startLocalServer({
            arguments_: ['dist/api/main.js'],
            port: 3043,
            healthPath: '/api/health',
            env: { DATABASE_URL: databaseUrl, APP_ORIGIN: origin, SMTP_PORT: String(port) },
          });
          const proof = await attempt(origin);
          const known = await requestRecovery(origin, proof, account.email);
          await requestRecovery(origin, proof, `unknown-${randomUUID()}@example.test`);
          const pending = (await client.query('SELECT * FROM "PasswordRecovery" WHERE id=$1', [known.pendingId])).rows[0];
          assert.equal(pending.deliveredAt, null);
          assert.ok(pending.deliveryFailedAt);
          assert.equal(pending.consumedAt, null);
          const athlete = (
            await client.query('SELECT "passwordHash","accessRevision" FROM "Athlete" WHERE id=$1', [account.athleteId])
          ).rows[0];
          assert.deepEqual(athlete, { passwordHash: encoded, accessRevision: 1 });
          assert.ok(await verifyPassword(oldPassword, athlete.passwordHash));
          await server.stop();
          server = undefined;
        }
        server = await startLocalServer({
          arguments_: ['dist/api/main.js'],
          port: 3043,
          healthPath: '/api/health',
          env: { DATABASE_URL: databaseUrl, APP_ORIGIN: origin, SMTP_PORT: smtpPort },
        });
        const proof = await attempt(origin);
        await requestRecovery(origin, proof, account.email);
        const { token } = await findLink(account.email);
        assert.equal((await post(origin, proof, 'recovery/confirm', { token, password: newPassword })).status, 201);
      } finally {
        await server?.stop();
        await new Promise((resolve) => rejectingSmtp.close(resolve));
        await client.end();
      }
    });
  },
);
