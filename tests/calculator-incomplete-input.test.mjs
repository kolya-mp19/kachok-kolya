import assert from 'node:assert/strict';
import test from 'node:test';
import { startLocalServer } from './helpers/local-server.mjs';
import { launchBrowser } from './helpers/browser.mjs';

function card(page, number) {
  return page.getByRole('region', { name: `Спортсмен ${number}`, exact: true });
}

function rankingRow(page, number) {
  return page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: `Спортсмен ${number}`, exact: true }) });
}

async function readValue(row, label) {
  return await row.getByText(label, { exact: true }).locator('..').locator('dd').innerText();
}

async function fillParticipant(participant, { weight = '80', attempt = '50', sex = 'Мужской' } = {}) {
  await participant.getByText(sex, { exact: true }).click();
  await participant.getByLabel('Собственный вес, кг', { exact: true }).fill(weight);
  await participant.getByLabel('Попытка 1', { exact: true }).fill(attempt);
}

test('незавершённый числовой ввод сохраняется без ошибок и не блокирует другие карточки', { timeout: 60000 }, async () => {
  const server = await startLocalServer({ arguments_: ['dist/api/main.js'], port: 3024, healthPath: '/api/health' });
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage({
      viewport: { width: 320, height: 280 },
      locale: 'ru-RU',
      isMobile: true,
      hasTouch: true,
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${server.origin}/calculator`);
    const first = card(page, 1);
    await fillParticipant(first);
    await page.getByRole('button', { name: 'Добавить спортсмена' }).click();
    const second = card(page, 2);
    await fillParticipant(second, { weight: '82,5', attempt: '52,5' });
    const row = rankingRow(page, 2);
    const commaScore = await readValue(row, 'Итог');
    await second.getByLabel('Собственный вес, кг', { exact: true }).fill('82.5');
    await second.getByLabel('Попытка 1', { exact: true }).fill('52.5');
    assert.equal(await readValue(row, 'Итог'), commaScore);
    const firstScore = await readValue(rankingRow(page, 1), 'Итог');

    for (const fieldLabel of ['Собственный вес, кг', 'Попытка 1']) {
      const input = second.getByLabel(fieldLabel, { exact: true });
      assert.equal(await input.getAttribute('inputmode'), 'decimal');
      for (const value of ['', 'текст', '0', '-5', '-', ',', '.', '8e', '8e-']) {
        await input.fill(value);
        assert.equal(await input.inputValue(), value);
        assert.equal(await input.evaluate((element) => element === document.activeElement), true);
        assert.equal(await readValue(row, 'Коэффициент'), '—');
        assert.equal(await readValue(row, 'Итог'), '—');
        assert.match(await row.innerText(), /Место: —/);
        assert.equal(await readValue(rankingRow(page, 1), 'Итог'), firstScore);
        assert.equal(await page.getByRole('alert').count(), 0);
        assert.equal(await page.locator('[aria-invalid="true"], .ant-form-item-explain-error').count(), 0);
      }
      await input.fill(fieldLabel === 'Попытка 1' ? '52,5' : '82,5');
    }

    // Набор посимвольно проходит промежуточные состояния русской десятичной записи.
    const attempt = second.getByLabel('Попытка 1', { exact: true });
    await attempt.fill('');
    await attempt.pressSequentially('70,5');
    assert.equal(await attempt.inputValue(), '70,5');
    assert.match(await second.getByRole('status').innerText(), /Лучшая попытка: 70,5 кг/);
    assert.equal(await attempt.evaluate((element) => element === document.activeElement), true);
    assert.deepEqual(await page.locator('.calculator-ranking-row h3').allTextContents(), ['Спортсмен 2', 'Спортсмен 1']);
    await second.getByRole('button', { name: 'Свернуть' }).click();
    await first.getByLabel('Попытка 1', { exact: true }).fill('90');
    assert.deepEqual(await page.locator('.calculator-ranking-row h3').allTextContents(), ['Спортсмен 1', 'Спортсмен 2']);
    await second.getByRole('button', { name: 'Развернуть' }).click();
    assert.equal(await attempt.inputValue(), '70,5');
    await attempt.fill('100');
    await row.scrollIntoViewIfNeeded();
    assert.equal(await attempt.evaluate((element) => element === document.activeElement), true);
    assert.equal(await row.isVisible(), true);
    assert.equal(new URL(page.url()).pathname, '/calculator');
    assert.deepEqual(await page.locator('.calculator-ranking-row h3').allTextContents(), ['Спортсмен 2', 'Спортсмен 1']);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await server.stop();
  }
});

test(
  'края Уилкса показывают отрицательный итог и прочерки неконечного расчёта без потери ввода',
  { timeout: 60000 },
  async () => {
    const server = await startLocalServer({ arguments_: ['dist/api/main.js'], port: 3025, healthPath: '/api/health' });
    let browser;
    try {
      browser = await launchBrowser();
      const page = await browser.newPage({ viewport: { width: 320, height: 280 }, locale: 'ru-RU' });
      await page.goto(`${server.origin}/calculator`);
      await fillParticipant(card(page, 1));
      const firstScore = await readValue(rankingRow(page, 1), 'Итог');
      await page.getByRole('button', { name: 'Добавить спортсмена' }).click();
      const second = card(page, 2);
      await fillParticipant(second, { sex: 'Женский', weight: '210' });
      const row = rankingRow(page, 2);
      assert.match(await readValue(row, 'Коэффициент'), /^-/);
      assert.match(await readValue(row, 'Итог'), /^-/);
      assert.match(await row.innerText(), /Место: 2/);

      // Рядом с полюсом женского Уилкса конечная попытка переполняет итог:
      // R8.1 скрывает обе вычисленные величины, сохраняя лучшую попытку и сам ввод.
      await second.getByLabel('Собственный вес, кг', { exact: true }).fill('208');
      await second.getByLabel('Попытка 1', { exact: true }).fill('1.7976931348623157e308');
      assert.equal(await readValue(row, 'Коэффициент'), '—');
      assert.equal(await readValue(row, 'Итог'), '—');
      assert.match(await row.innerText(), /Место: —/);
      assert.notEqual(await readValue(row, 'Лучшая попытка, кг'), '—');
      assert.equal(await second.getByLabel('Попытка 1', { exact: true }).inputValue(), '1.7976931348623157e308');
      assert.equal(await readValue(rankingRow(page, 1), 'Итог'), firstScore);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

      await second.getByLabel('Попытка 1', { exact: true }).fill('50');
      assert.notEqual(await readValue(row, 'Итог'), '—');
      assert.match(await row.innerText(), /Место: 1/);
      await second.getByLabel('Собственный вес, кг', { exact: true }).fill('1.7976931348623157e308');
      assert.equal(await readValue(row, 'Коэффициент'), '—');
      assert.equal(await readValue(row, 'Итог'), '—');
      assert.equal(await readValue(row, 'Лучшая попытка, кг'), '50');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

      await second.getByLabel('Собственный вес, кг', { exact: true }).fill('1000');
      await second.getByLabel('Попытка 1', { exact: true }).fill('5e-324');
      assert.notEqual(await readValue(row, 'Коэффициент'), '—');
      assert.notEqual(await readValue(row, 'Итог'), '—');
      assert.match(await row.innerText(), /Место: 2/);
      assert.equal(await page.getByRole('alert').count(), 0);
    } finally {
      await browser?.close();
      await server.stop();
    }
  },
);
