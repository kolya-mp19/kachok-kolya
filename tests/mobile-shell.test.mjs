import assert from 'node:assert/strict';
import { startLocalServer } from './helpers/local-server.mjs';
import { launchBrowser } from './helpers/browser.mjs';
import test from 'node:test';

test('мобильная оболочка сохраняет навигацию при загрузке и сбое разделов', { timeout: 60000 }, async (t) => {
  const server = await startLocalServer({
    arguments_: ['dist/api/main.js'],
    port: 3018,
    healthPath: '/api/health',
  });
  const { origin } = server;
  let browser;
  try {
    browser = await launchBrowser();

    await t.test('прямые входы, обновление и переходы доступны на узком экране', async () => {
      for (const width of [320, 360, 390]) {
        const page = await browser.newPage({ viewport: { width, height: 280 } });
        const requests = [];
        page.on('request', (request) => requests.push(request.url()));
        try {
          await page.goto(`${origin}/calculator`);
          await page.getByRole('heading', { name: 'Рейтинг · Уилкс' }).waitFor();
          assert.ok(!requests.some((url) => /\/api\/|session|DiaryPage/.test(url)), requests.join('\n'));
          const nav = page.getByRole('navigation', { name: 'Разделы приложения' });
          assert.equal(await nav.getByRole('link', { name: 'Калькулятор', exact: true }).getAttribute('aria-current'), 'page');
          for (const link of await nav.getByRole('link').all()) {
            assert.ok((await link.boundingBox()).height >= 44);
          }
          await nav.getByRole('link', { name: 'Дневник', exact: true }).click();
          await page.getByRole('heading', { name: 'Вход по почте' }).waitFor();
          await page.reload();
          await page.getByRole('heading', { name: 'Вход по почте' }).waitFor();
          await page.evaluate(() => {
            document.documentElement.style.fontSize = '200%';
          });
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
          await nav.getByRole('link', { name: 'Калькулятор', exact: true }).click();
          await page.reload();
          await page.getByRole('heading', { name: 'Рейтинг · Уилкс' }).waitFor();
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
          await page.keyboard.press('Tab');
          await page.keyboard.press('Enter');
          assert.equal(await page.evaluate(() => document.activeElement?.id), 'main-content');
        } finally {
          await page.close();
        }
      }
    });

    for (const [path, chunk, heading, other, otherHeading] of [
      ['/calculator', 'CalculatorPage', 'Рейтинг · Уилкс', 'Дневник', 'Вход по почте'],
      ['/diary', 'DiaryPage', 'Вход по почте', 'Калькулятор', 'Рейтинг · Уилкс'],
    ]) {
      await t.test(`${path}: ожидание настоящего модуля видно пользователю`, async () => {
        const page = await browser.newPage({ viewport: { width: 320, height: 280 } });
        let release;
        const gate = new Promise((resolve) => {
          release = resolve;
        });
        await page.route(`**/${chunk}-*.js`, async (route) => {
          await gate;
          await route.continue();
        });
        try {
          await page.goto(`${origin}${path}`, { waitUntil: 'domcontentloaded' });
          await page.getByRole('status').filter({ hasText: 'Загружаем раздел…' }).waitFor();
          assert.equal(await page.getByRole('navigation').getByRole('link').count(), 2);
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
          release();
          await page.getByRole('heading', { name: heading }).waitFor();
          assert.equal(await page.getByRole('status').filter({ hasText: 'Загружаем раздел…' }).count(), 0);
        } finally {
          release();
          await page.close();
        }
      });

      await t.test(`${path}: сбой загрузки допускает обновление и смену раздела`, async () => {
        const page = await browser.newPage({ viewport: { width: 320, height: 280 } });
        const pattern = `**/${chunk}-*.js`;
        await page.route(pattern, (route) => route.abort('failed'));
        try {
          await page.goto(`${origin}${path}`);
          const error = page.getByRole('alert');
          await error.getByRole('heading', { name: 'Не удалось открыть раздел' }).waitFor();
          assert.doesNotMatch(await page.locator('body').innerText(), /TypeError|Error:|stack|\.js|\/assets\/|Failed to fetch/);
          await page.evaluate(() => {
            document.documentElement.style.fontSize = '200%';
          });
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
          assert.ok((await error.getByRole('button', { name: 'Обновить страницу' }).boundingBox()).height >= 44);
          await page.getByRole('navigation').getByRole('link', { name: other, exact: true }).click();
          await page.getByRole('heading', { name: otherHeading }).waitFor();
          await page.goto(`${origin}${path}`);
          await error.waitFor();
          await page.unroute(pattern);
          await error.getByRole('button', { name: 'Обновить страницу' }).click();
          await page.getByRole('heading', { name: heading }).waitFor();
        } finally {
          await page.close();
        }
      });
    }
  } finally {
    await browser?.close();
    await server.stop();
  }
});
