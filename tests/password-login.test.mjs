import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import pg from 'pg';
import { withTestDatabase, runStorageCli } from './helpers/test-database.mjs';
import { startLocalServer } from './helpers/local-server.mjs';
import { launchBrowser } from './helpers/browser.mjs';
import { hashPassword, hashSecret } from '../dist/api/auth/auth-secrets.js';

const password = 'длинный пароль дневника 123';

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

test(
  'вход по паролю возвращает прежний дневник и не позволяет повторной регистрации менять доступ',
  { timeout: 180000 },
  async (t) => {
    await withTestDatabase(async (databaseUrl) => {
      assert.equal(runStorageCli('migrate', databaseUrl).status, 0);
      const client = new pg.Client({ connectionString: databaseUrl });
      await client.connect();
      const origin = 'http://127.0.0.1:3041';
      const server = await startLocalServer({
        arguments_: ['dist/api/main.js'],
        port: 3041,
        healthPath: '/api/health',
        env: { DATABASE_URL: databaseUrl, APP_ORIGIN: origin },
      });
      const athleteId = randomUUID();
      const diaryId = randomUUID();
      const email = `login-${randomUUID()}@example.test`;
      const encoded = await hashPassword(password);
      let browser;
      try {
        await client.query(
          'INSERT INTO "Athlete" (id, name, email, "normalizedEmail", "passwordHash", "accessRevision") VALUES ($1, $2, $3, $3, $4, 7)',
          [athleteId, 'Коля', email, encoded],
        );
        await client.query('INSERT INTO "Diary" (id, "athleteId") VALUES ($1, $2)', [diaryId, athleteId]);
        await client.query(
          'INSERT INTO "OperationReceipt" ("athleteId", "operationId", "recoveryGeneration", "commandHash", revision, result) VALUES ($1, $2, $3, $4, $5, $6)',
          [athleteId, randomUUID(), 'generation', 'synthetic', '1', JSON.stringify({ note: 'проверочная запись' })],
        );
        const proof = await attempt(origin);

        await t.test('правильный пароль, нормализация и новая сессия сохраняют дневник; прежняя сессия отозвана', async () => {
          const first = await post(origin, proof, 'login', { email: ` ${email.toUpperCase()} `, password });
          assert.equal(first.status, 201, await first.clone().text());
          const identity = await first.json();
          assert.equal(identity.athleteId, athleteId);
          assert.equal(identity.diaryId, diaryId);
          const firstCookie = first.headers.get('set-cookie').split(';')[0];
          const second = await post(origin, proof, 'login', { email, password }, { Cookie: `${proof.cookie}; ${firstCookie}` });
          assert.equal(second.status, 201);
          const secondIdentity = await second.json();
          const secondCookie = second.headers.get('set-cookie').split(';')[0];
          assert.notEqual(secondCookie, firstCookie);
          assert.notEqual(identity.csrfToken, secondIdentity.csrfToken);
          assert.equal((await fetch(`${origin}/api/auth/session`, { headers: { Cookie: firstCookie } })).status, 401);
          const reopened = await fetch(`${origin}/api/auth/session`, { headers: { Cookie: secondCookie } });
          assert.deepEqual(await reopened.json(), { athleteId, diaryId, name: 'Коля' });
          const session = (
            await client.query('SELECT "accessRevision" FROM "AuthSession" WHERE "tokenHash" = $1', [
              hashSecret(secondCookie.split('=')[1]),
            ])
          ).rows[0];
          assert.equal(session.accessRevision, 7);
        });

        await t.test('неверный пароль, неизвестный адрес и удалённый хеш дают одинаковый отказ без сессии', async () => {
          const noHashId = randomUUID();
          const noHashEmail = `no-hash-${randomUUID()}@example.test`;
          await client.query('INSERT INTO "Athlete" (id, name, email, "normalizedEmail") VALUES ($1, $2, $3, $3)', [
            noHashId,
            'После восстановления',
            noHashEmail,
          ]);
          await client.query('INSERT INTO "Diary" (id, "athleteId") VALUES ($1, $2)', [randomUUID(), noHashId]);
          for (const input of [
            { email, password: 'неверный пароль' },
            { email: `unknown-${randomUUID()}@example.test`, password },
            { email: noHashEmail, password },
            { email },
          ]) {
            const response = await post(origin, proof, 'login', input);
            assert.equal(response.status, 401);
            assert.equal((await response.json()).code, 'INVALID_LOGIN');
            assert.equal(response.headers.get('set-cookie'), null);
          }
          assert.equal(
            (await client.query('SELECT "passwordHash" FROM "Athlete" WHERE id=$1', [noHashId])).rows[0].passwordHash,
            null,
          );
        });

        await t.test('вход требует browser CSRF и разрешённый Origin', async () => {
          const input = { email, password };
          assert.equal((await post(origin, proof, 'login', input, { Origin: 'http://foreign.test' })).status, 403);
          assert.equal((await post(origin, proof, 'login', input, { 'X-CSRF-Token': '' })).status, 403);
          const other = await attempt(origin);
          assert.equal((await post(origin, other, 'login', input, { 'X-CSRF-Token': proof.csrfToken })).status, 403);
        });

        await t.test(
          'повторная регистрация не меняет атлета, дневник, пароль и записи и не отправляет подтверждение',
          async () => {
            const before = (await client.query('SELECT * FROM "Athlete" WHERE id=$1', [athleteId])).rows[0];
            const receipts = (await client.query('SELECT * FROM "OperationReceipt" WHERE "athleteId"=$1', [athleteId])).rows;
            const response = await post(origin, proof, 'registration', {
              name: 'Другой атлет',
              email: email.toUpperCase(),
              password: 'совсем другой пароль',
            });
            assert.equal(response.status, 409);
            assert.equal((await response.json()).code, 'EMAIL_UNAVAILABLE');
            assert.equal(response.headers.get('set-cookie'), null);
            assert.deepEqual((await client.query('SELECT * FROM "Athlete" WHERE id=$1', [athleteId])).rows[0], before);
            assert.deepEqual(
              (await client.query('SELECT * FROM "OperationReceipt" WHERE "athleteId"=$1', [athleteId])).rows,
              receipts,
            );
            assert.equal((await client.query('SELECT id FROM "Diary" WHERE "athleteId"=$1', [athleteId])).rows[0].id, diaryId);
            assert.equal(
              (await client.query('SELECT count(*)::int AS count FROM "PendingEmailAction" WHERE "normalizedEmail"=$1', [email]))
                .rows[0].count,
              0,
            );
            assert.equal((await post(origin, proof, 'login', { email, password: 'совсем другой пароль' })).status, 401);
            assert.equal((await post(origin, proof, 'login', { email, password })).status, 201);
          },
        );

        await t.test(
          'сменившиеся во время проверки пароль и редакция не позволяют выдать сессию по старому доказательству',
          async () => {
            const blocker = new pg.Client({ connectionString: databaseUrl });
            await blocker.connect();
            let pending;
            try {
              await blocker.query('BEGIN');
              await blocker.query('SELECT id FROM "Athlete" WHERE id=$1 FOR UPDATE', [athleteId]);
              pending = post(origin, proof, 'login', { email, password });
              let isWaiting = false;
              for (let index = 0; index < 100; index++) {
                const waiting = await client.query(
                  "SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%FROM \"Athlete\"%FOR UPDATE%'",
                );
                if (waiting.rows[0].count > 0) {
                  isWaiting = true;
                  break;
                }
                await setTimeout(25);
              }
              assert.ok(isWaiting, 'Вход должен ждать общей блокировки владельца после Argon2id');
              await blocker.query('UPDATE "Athlete" SET "passwordHash"=NULL, "accessRevision"=8 WHERE id=$1', [athleteId]);
              await blocker.query('COMMIT');
              const response = await pending;
              assert.equal(response.status, 401);
              assert.equal(response.headers.get('set-cookie'), null);
            } finally {
              await blocker.query('ROLLBACK');
              await blocker.end();
              await pending;
              await client.query('UPDATE "Athlete" SET "passwordHash"=$2 WHERE id=$1', [athleteId, encoded]);
            }
          },
        );

        await t.test('лимиты адреса и IP хранятся отдельно от регистрации и допускают повтор после окна', async () => {
          const key = `login:email:${hashSecret(email)}`;
          await client.query('UPDATE "AuthRateBucket" SET count=10 WHERE key=$1', [key]);
          assert.equal((await post(origin, proof, 'login', { email, password })).status, 429);
          await client.query('UPDATE "AuthRateBucket" SET "windowStart"=now()-interval \'1 hour\' WHERE key=$1', [key]);
          assert.equal((await post(origin, proof, 'login', { email, password })).status, 201);
          const ipKey = (await client.query('SELECT key FROM "AuthRateBucket" WHERE key LIKE \'login:ip:%\'')).rows[0].key;
          await client.query('UPDATE "AuthRateBucket" SET count=30 WHERE key=$1', [ipKey]);
          assert.equal((await post(origin, proof, 'login', { email: 'other@example.test', password })).status, 429);
          await client.query('UPDATE "AuthRateBucket" SET "windowStart"=now()-interval \'1 hour\' WHERE key=$1', [ipKey]);
        });

        await t.test(
          'мобильный вход доступен сразу; ошибка сохраняет поля, повторная регистрация предлагает действующий вход',
          async () => {
            browser = await launchBrowser();
            const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
            try {
              await page.goto(`${origin}/diary`);
              await page.getByRole('heading', { name: 'Вход по почте' }).waitFor();
              assert.equal(await page.locator('input[autocomplete="current-password"]').count(), 1);
              await page.getByLabel('Почта', { exact: true }).fill(email);
              await page.getByLabel('Пароль', { exact: true }).fill('неверный пароль');
              await page.getByRole('button', { name: 'Войти', exact: true }).click();
              await page.getByRole('alert').waitFor();
              assert.equal(await page.getByLabel('Пароль', { exact: true }).inputValue(), 'неверный пароль');
              await page.getByRole('button', { name: 'Создать дневник', exact: true }).click();
              await page.getByLabel('Имя', { exact: true }).fill('Повтор');
              await page.getByLabel('Почта', { exact: true }).fill(email);
              await page.getByLabel('Пароль', { exact: true }).fill(password);
              await page.getByRole('button', { name: 'Отправить письмо', exact: true }).click();
              await page.getByText('Этот адрес уже зарегистрирован. Войдите в прежний дневник.').waitFor();
              await page.getByRole('button', { name: 'Войти в прежний дневник', exact: true }).click();
              await page.getByLabel('Почта', { exact: true }).fill(email);
              await page.getByLabel('Пароль', { exact: true }).fill(password);
              await page.evaluate(() => {
                document.documentElement.style.fontSize = '200%';
              });
              assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
              await mkdir('.scratch/e009', { recursive: true });
              await page.screenshot({ path: '.scratch/e009/t002-login-320.png', fullPage: true });
              await page.getByRole('button', { name: 'Войти', exact: true }).click();
              await page.getByRole('heading', { name: 'Ваш дневник пока пуст' }).waitFor();
              await page.reload();
              await page.getByRole('heading', { name: 'Ваш дневник пока пуст' }).waitFor();
              assert.equal(await page.getByRole('button', { name: 'Создать цикл' }).count(), 0);
              assert.equal(await page.getByRole('button', { name: /Яндекс|ВКонтакте/ }).count(), 0);
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
  },
);
