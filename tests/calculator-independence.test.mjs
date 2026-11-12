import assert from 'node:assert/strict';
import test from 'node:test';
import { startLocalServer } from './helpers/local-server.mjs';
import { launchBrowser } from './helpers/browser.mjs';

// Наблюдение сохраняет нативное поведение: отказ сети задаётся браузером,
// а отсутствие чтения/записи проверяется отдельно, включая чтение свойств через [].
function observeContextBoundaries() {
  window.calculatorBoundaryCalls = [];
  const record = (operation) => window.calculatorBoundaryCalls.push(operation);
  for (const property of ['localStorage', 'sessionStorage', 'indexedDB']) {
    const descriptor = Object.getOwnPropertyDescriptor(window, property);
    Object.defineProperty(window, property, {
      ...descriptor,
      get() {
        record(property);
        return descriptor.get.call(this);
      },
    });
  }
  const cookie = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
  Object.defineProperty(Document.prototype, 'cookie', {
    ...cookie,
    get() {
      record('cookie.get');
      return cookie.get.call(this);
    },
    set(value) {
      record('cookie.set');
      cookie.set.call(this, value);
    },
  });
  const fetch = window.fetch;
  window.fetch = function (...args) {
    record('fetch');
    return fetch.apply(this, args);
  };
  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (...args) {
    record('xhr.open');
    return open.apply(this, args);
  };
}

async function readStorage(page) {
  return await page.evaluate(async () => {
    const databases = (await indexedDB.databases()).map(({ name }) => name).sort();
    let draft = null;
    if (databases.includes('kachok-drafts')) {
      draft = await new Promise((resolve, reject) => {
        const request = indexedDB.open('kachok-drafts');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction('drafts', 'readonly');
          const record = transaction.objectStore('drafts').get('synthetic-draft');
          transaction.oncomplete = () => {
            database.close();
            resolve(record.result);
          };
          transaction.onabort = () => {
            database.close();
            reject(transaction.error);
          };
        };
      });
    }
    return { local: Object.entries(localStorage).sort(), session: Object.entries(sessionStorage).sort(), databases, draft };
  });
}

async function seedDiaryMarkers(page) {
  // Это синтетические маркеры окружения, а не обход входа E009 или настоящий черновик.
  await page.evaluate(async () => {
    localStorage.setItem('diary-profile', JSON.stringify({ athleteId: 'synthetic-athlete', bodyWeight: '123.45' }));
    sessionStorage.setItem('diary-editor', 'synthetic-private-input');
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('kachok-drafts', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('drafts', { keyPath: 'id' });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('drafts', 'readwrite');
        transaction.objectStore('drafts').put({ id: 'synthetic-draft', ciphertext: 'synthetic-ciphertext' });
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onabort = () => {
          database.close();
          reject(transaction.error);
        };
      };
    });
  });
}

async function assertEmptyComparison(page) {
  const first = page.getByRole('region', { name: 'Спортсмен 1', exact: true });
  await first.waitFor();
  assert.equal(await page.locator('.calculator-card').count(), 1);
  assert.deepEqual(await first.getByRole('textbox').evaluateAll((inputs) => inputs.map((input) => input.value)), [
    '',
    '',
    '',
    '',
    '',
  ]);
  assert.equal(await first.getByRole('radio', { checked: true }).count(), 0);
  assert.equal(await page.getByRole('radio', { name: 'Уилкс', exact: true }).isChecked(), true);
  assert.equal(await first.getByRole('button', { name: 'Свернуть' }).getAttribute('aria-expanded'), 'true');
  const ranking = page.getByRole('region', { name: 'Рейтинг · Уилкс', exact: true });
  assert.equal(await ranking.getByRole('listitem').count(), 1);
  assert.match(await ranking.innerText(), /Место: —/);
  assert.deepEqual(await ranking.locator('dd').allTextContents(), ['—', '—', '—', '—', '—']);
  assert.equal(await ranking.locator('.calculator-leader').count(), 0);
  assert.equal(await ranking.getByRole('button', { name: 'Показать точнее' }).getAttribute('aria-expanded'), 'false');
}

async function assertNoBoundaryCalls(page) {
  assert.deepEqual(await page.evaluate(() => window.calculatorBoundaryCalls), []);
}

for (const [index, hasDiaryMarkers] of [false, true].entries()) {
  test(
    `калькулятор независим и временный ${hasDiaryMarkers ? 'при синтетических данных дневника' : 'в пустом браузере'}`,
    { timeout: 60000 },
    async () => {
      const server = await startLocalServer({ arguments_: ['dist/api/main.js'], port: 3030 + index, healthPath: '/api/health' });
      let browser;
      try {
        browser = await launchBrowser();
        const context = await browser.newContext({
          viewport: { width: 320, height: 280 },
          locale: 'ru-RU',
          isMobile: true,
          hasTouch: true,
        });
        await context.route('**/__e008_fixture', (route) =>
          route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Test fixture</title>' }),
        );
        await context.route('**/api/**', (route) => route.abort());
        if (hasDiaryMarkers) {
          // Браузер отправляет HttpOnly cookie автоматически. Клиентский код калькулятора
          // не должен читать cookie или спрашивать сервер, действительна ли эта сессия.
          await context.addCookies([
            { name: 'local-session', value: 'synthetic-session-token', url: server.origin, httpOnly: true, sameSite: 'Lax' },
          ]);
        }
        const page = await context.newPage();
        const errors = [];
        context.on('page', (opened) => opened.on('pageerror', (error) => errors.push(error.message)));
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(`${server.origin}/__e008_fixture`);
        if (hasDiaryMarkers) {
          await seedDiaryMarkers(page);
        }
        const initialStorage = await readStorage(page);
        const initialCookies = await context.cookies();
        await context.addInitScript(observeContextBoundaries);

        // Калибровка на пустой странице доказывает, что наблюдатели действительно
        // замечают обращения; её действия не попадают в журнал калькулятора.
        await page.reload();
        await page.evaluate(async () => {
          void localStorage;
          void sessionStorage;
          void indexedDB;
          void document.cookie;
          document.cookie = 'e008-probe=; Max-Age=0; Path=/';
          await fetch('/__e008_fixture');
          new XMLHttpRequest().open('GET', '/__e008_fixture');
        });
        assert.deepEqual(await page.evaluate(() => window.calculatorBoundaryCalls), [
          'localStorage',
          'sessionStorage',
          'indexedDB',
          'cookie.get',
          'cookie.set',
          'fetch',
          'xhr.open',
        ]);

        const requests = [];
        context.on('request', (request) => requests.push(request.url()));
        await page.goto(`${server.origin}/calculator`);
        await assertEmptyComparison(page);
        await assertNoBoundaryCalls(page);
        const loadedRequests = requests.length;
        await context.setOffline(true);
        const first = page.locator('.calculator-card').nth(0);
        await first.getByLabel('Имя (необязательно)', { exact: true }).fill('Сравнение первой вкладки');
        await first.getByText('Мужской', { exact: true }).click();
        await first.getByLabel('Собственный вес, кг', { exact: true }).fill('80');
        await first.getByLabel('Попытка 1', { exact: true }).fill('50');
        await page.getByRole('button', { name: 'Добавить спортсмена' }).click();
        const second = page.locator('.calculator-card').nth(1);
        await second.getByText('Женский', { exact: true }).click();
        await second.getByLabel('Собственный вес, кг', { exact: true }).fill('60');
        await second.getByLabel('Попытка 1', { exact: true }).fill('30,8');
        await first.getByRole('button', { name: 'Свернуть' }).click();
        for (const [formula, expectedScore] of [
          ['Уилкс', '34,13'],
          ['IPF GL — адаптация для бицепса', '7,05'],
          ['DOTS', '34,48'],
        ]) {
          await page.getByRole('radio', { name: formula, exact: true }).check();
          const ranking = page.getByRole('region', { name: `Рейтинг · ${formula}`, exact: true });
          const row = ranking
            .getByRole('listitem')
            .filter({ has: page.getByRole('heading', { name: 'Сравнение первой вкладки', exact: true }) });
          assert.equal(await row.getByText('Итог', { exact: true }).locator('..').locator('dd').innerText(), expectedScore);
        }
        await second.getByLabel('Попытка 1', { exact: true }).fill('35');
        await page.getByRole('button', { name: 'Добавить спортсмена' }).click();
        await page.locator('.calculator-card').nth(2).getByRole('button', { name: 'Удалить спортсмена' }).click();
        await page.getByRole('button', { name: 'Показать точнее' }).click();
        assert.equal(await page.locator('.calculator-card').count(), 2);
        assert.equal(new URL(page.url()).pathname, '/calculator');
        assert.equal(requests.length, loadedRequests);
        await assertNoBoundaryCalls(page);

        // Перезагрузка требует доступной статики. Это не обещание оффлайн-загрузки:
        // проверяется только независимость расчётов после загрузки страницы.
        await context.setOffline(false);
        const anotherTab = await context.newPage();
        await anotherTab.goto(`${server.origin}/calculator`);
        await assertEmptyComparison(anotherTab);
        await assertNoBoundaryCalls(anotherTab);
        assert.equal(await first.getByRole('button', { name: 'Развернуть' }).count(), 1);
        assert.equal(await page.getByRole('radio', { name: 'DOTS', exact: true }).isChecked(), true);
        assert.equal(await second.getByLabel('Попытка 1', { exact: true }).inputValue(), '35');
        await assertNoBoundaryCalls(page);
        await anotherTab.close();
        await page.reload();
        await assertEmptyComparison(page);
        await assertNoBoundaryCalls(page);
        assert.ok(!requests.some((url) => /\/api\/|session|DiaryPage/.test(url)), requests.join('\n'));
        assert.deepEqual(await context.cookies(), initialCookies);
        assert.deepEqual(errors, []);

        // Читаем маркеры тестом уже вне приложения, не смешивая контроль сохранности
        // с журналом обращений самого калькулятора.
        await page.goto(`${server.origin}/__e008_fixture`);
        assert.deepEqual(await readStorage(page), initialStorage);
        await context.close();
      } finally {
        await browser?.close();
        await server.stop();
      }
    },
  );
}
