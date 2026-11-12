import assert from 'node:assert/strict';
import test from 'node:test';
import { startLocalServer } from './helpers/local-server.mjs';
import { launchBrowser } from './helpers/browser.mjs';

test('мобильное сравнение Уилкса сохраняет карточки и полный рейтинг при пересортировке', { timeout: 60000 }, async () => {
  const server = await startLocalServer({ arguments_: ['dist/api/main.js'], port: 3023, healthPath: '/api/health' });
  let browser;
  try {
    browser = await launchBrowser();
    for (const width of [320, 360, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 280 }, locale: 'ru-RU' });
      const requests = [];
      page.on('request', (request) => requests.push(request.url()));
      try {
        await page.route('**/api/**', (route) => route.abort());
        await page.goto(`${server.origin}/calculator`);
        const first = page.getByRole('region', { name: 'Спортсмен 1', exact: true });
        const ranking = page.getByRole('region', { name: 'Рейтинг · Уилкс', exact: true });
        await first.waitFor();
        assert.equal(await page.locator('.calculator-card').count(), 1);
        assert.equal(await first.getByRole('radio', { checked: true }).count(), 0);
        assert.equal(await page.getByRole('button', { name: 'Рассчитать', exact: true }).count(), 0);
        assert.equal(await first.getByRole('button', { name: 'Удалить спортсмена' }).isDisabled(), true);
        assert.match(await first.innerText(), /Должен остаться хотя бы один спортсмен/);
        assert.match(await ranking.innerText(), /Место: —/);

        await first.getByLabel('Попытка 1', { exact: true }).fill('52,5');
        assert.match(await first.getByRole('status').innerText(), /Лучшая попытка: 52,5 кг/);
        assert.match(await first.getByRole('status').innerText(), /Коэффициент: —[\s\S]*Итог: —/);
        await first.getByLabel('Собственный вес, кг', { exact: true }).fill('80');
        await first.getByText('Мужской', { exact: true }).click();
        assert.match(await ranking.innerText(), /Место: 1/);
        assert.match(await ranking.innerText(), /★ Лидер/);

        await page.getByRole('button', { name: 'Добавить спортсмена' }).click();
        const second = page.getByRole('region', { name: 'Спортсмен 2', exact: true });
        assert.equal(await page.evaluate(() => document.activeElement.id), 'participant-2-heading');
        await page.keyboard.press('Tab');
        assert.equal(
          await second.getByLabel('Имя (необязательно)', { exact: true }).evaluate((input) => input === document.activeElement),
          true,
        );
        await second.getByLabel('Собственный вес, кг', { exact: true }).fill('80');
        await second.getByText('Мужской', { exact: true }).click();
        await second.getByLabel('Попытка 1', { exact: true }).fill('60');
        assert.deepEqual(await ranking.getByRole('heading', { level: 3 }).allTextContents(), ['Спортсмен 2', 'Спортсмен 1']);
        assert.equal(
          await second.getByLabel('Попытка 1', { exact: true }).evaluate((input) => input === document.activeElement),
          true,
        );
        assert.equal(await first.getByLabel('Попытка 1', { exact: true }).inputValue(), '52,5');
        assert.equal(await second.getByLabel('Попытка 1', { exact: true }).inputValue(), '60');
        for (const label of ['Пол', 'Собственный вес, кг', 'Лучшая попытка, кг', 'Коэффициент', 'Итог']) {
          assert.equal(await ranking.locator('li').first().getByText(label, { exact: true }).isVisible(), true);
        }

        await first.getByRole('button', { name: 'Свернуть' }).click();
        assert.equal(await first.getByLabel('Попытка 1', { exact: true }).isVisible(), false);
        assert.match(await first.getByRole('status').innerText(), /52,5 кг/);
        await first.getByRole('button', { name: 'Развернуть' }).click();
        assert.equal(await first.getByLabel('Попытка 1', { exact: true }).inputValue(), '52,5');
        await first.getByLabel('Имя (необязательно)', { exact: true }).fill('Анна');
        const namedFirst = page.getByRole('region', { name: 'Анна', exact: true });
        await namedFirst.getByLabel('Попытка 2', { exact: true }).fill('70');
        assert.deepEqual(await ranking.getByRole('heading', { level: 3 }).allTextContents(), ['Анна', 'Спортсмен 2']);

        await page.getByRole('button', { name: 'Добавить спортсмена' }).click();
        assert.deepEqual(await ranking.getByRole('heading', { level: 3 }).allTextContents(), [
          'Анна',
          'Спортсмен 2',
          'Спортсмен 3',
        ]);
        assert.match(await ranking.locator('li').last().innerText(), /Место: —/);
        await second.getByRole('button', { name: 'Удалить спортсмена' }).click();
        assert.equal(await page.evaluate(() => document.activeElement.id), 'participant-3-heading');
        assert.deepEqual(await ranking.getByRole('heading', { level: 3 }).allTextContents(), ['Анна', 'Спортсмен 3']);
        await namedFirst.getByRole('button', { name: 'Удалить спортсмена' }).click();
        const third = page.getByRole('region', { name: 'Спортсмен 3', exact: true });
        assert.equal(await third.getByRole('button', { name: 'Удалить спортсмена' }).isDisabled(), true);
        await third.getByLabel('Попытка 1', { exact: true }).fill('40');
        assert.match(await ranking.innerText(), /Лучшая попытка, кг[\s\S]*40/);
        assert.ok(!requests.some((url) => /\/api\/|DiaryPage|session/.test(url)), requests.join('\n'));
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '200%';
        });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser?.close();
    await server.stop();
  }
});
