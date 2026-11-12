import assert from 'node:assert/strict';
import test from 'node:test';
import { startLocalServer } from './helpers/local-server.mjs';
import { launchBrowser } from './helpers/browser.mjs';

function card(page, number) {
  return page.getByRole('region', { name: `Спортсмен ${number}`, exact: true });
}

async function fillParticipant(participant, { weight = '80', attempt, sex = 'Мужской' }) {
  await participant.getByText(sex, { exact: true }).click();
  await participant.getByLabel('Собственный вес, кг', { exact: true }).fill(weight);
  await participant.getByLabel('Попытка 1', { exact: true }).fill(attempt);
}

async function readValue(row, label) {
  return await row.getByText(label, { exact: true }).locator('..').locator('dd').innerText();
}

// Входы передачи E007 дают точные итоги 40, 39, 40.004 и 40.003 без подмены ядра.
const cases = [
  { label: 'Уилкс', attempts: ['58.591010112', '57.1262348592', '58.596869213011196', '58.5954044377584'] },
  {
    label: 'IPF GL — адаптация для бицепса',
    attempts: ['283.61290208671755', '276.5225795345496', '283.6412633769262', '283.63417305437406'],
  },
  { label: 'DOTS', attempts: ['58.0091446528', '56.55891603648001', '58.01494556726528', '58.013495338648966'] },
];

test('общая формула пересчитывает значения, порядок и лидеров без потери карточек и фокуса', { timeout: 60000 }, async () => {
  const server = await startLocalServer({ arguments_: ['dist/api/main.js'], port: 3026, healthPath: '/api/health' });
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage({
      viewport: { width: 320, height: 280 },
      locale: 'ru-RU',
      isMobile: true,
      hasTouch: true,
    });
    await page.goto(`${server.origin}/calculator`);
    await fillParticipant(card(page, 1), { attempt: '50' });
    await page.getByRole('button', { name: 'Добавить спортсмена' }).click();
    await fillParticipant(card(page, 2), { weight: '60', attempt: '30.8', sex: 'Женский' });
    await card(page, 2).getByRole('button', { name: 'Свернуть' }).click();

    for (const [label, leader, coefficient, score] of [
      ['Уилкс', 'Спортсмен 2', '0,6827', '34,13'],
      ['IPF GL — адаптация для бицепса', 'Спортсмен 1', '0,1410', '7,05'],
      ['DOTS', 'Спортсмен 1', '0,6895', '34,48'],
      ['Уилкс', 'Спортсмен 2', '0,6827', '34,13'],
    ]) {
      const choice = page.getByRole('radio', { name: label, exact: true });
      await choice.click();
      const ranking = page.getByRole('region', { name: `Рейтинг · ${label}`, exact: true });
      assert.equal(await choice.isChecked(), true);
      assert.equal(await choice.evaluate((input) => input === document.activeElement), true);
      assert.equal(await ranking.locator('li').first().getByRole('heading').innerText(), leader);
      assert.equal(await ranking.locator('.calculator-leader').count(), 1);
      const firstRow = ranking.locator('li').filter({ has: page.getByRole('heading', { name: 'Спортсмен 1', exact: true }) });
      assert.equal(await readValue(firstRow, 'Коэффициент'), coefficient);
      assert.equal(await readValue(firstRow, 'Итог'), score);
      assert.equal(await card(page, 1).getByLabel('Попытка 1', { exact: true }).inputValue(), '50');
      assert.equal(await card(page, 2).getByRole('button', { name: 'Развернуть' }).count(), 1);
    }
    await card(page, 2).getByRole('button', { name: 'Развернуть' }).click();
    assert.equal(await card(page, 2).getByLabel('Попытка 1', { exact: true }).inputValue(), '30.8');
  } finally {
    await browser?.close();
    await server.stop();
  }
});

test('истинные равные итоги и близкие подписи сохраняют точные места во всех формулах', { timeout: 60000 }, async () => {
  const server = await startLocalServer({ arguments_: ['dist/api/main.js'], port: 3027, healthPath: '/api/health' });
  let browser;
  try {
    browser = await launchBrowser();
    for (const [index, { label, attempts }] of cases.entries()) {
      const page = await browser.newPage({ viewport: { width: [320, 360, 390][index], height: 280 }, locale: 'ru-RU' });
      try {
        await page.goto(`${server.origin}/calculator`);
        await page.getByRole('radio', { name: label, exact: true }).check();
        await fillParticipant(card(page, 1), { attempt: attempts[0] });
        await page.getByRole('button', { name: 'Добавить спортсмена' }).click();
        await fillParticipant(card(page, 2), { attempt: attempts[0] });
        await page.getByRole('button', { name: 'Добавить спортсмена' }).click();
        await fillParticipant(card(page, 3), { attempt: attempts[1] });
        const ranking = page.getByRole('region', { name: `Рейтинг · ${label}`, exact: true });
        assert.deepEqual(
          await ranking
            .locator('li')
            .getByText(/^Место:/)
            .allTextContents(),
          ['Место: 1', 'Место: 1', 'Место: 3'],
        );
        assert.equal(await ranking.locator('.calculator-leader').count(), 2);
        const leaders = ranking.locator('.calculator-leader');
        assert.equal(await leaders.nth(0).getAttribute('class'), await leaders.nth(1).getAttribute('class'));
        assert.equal(await leaders.nth(0).getByText('★ Лидер', { exact: true }).count(), 1);
        assert.equal(await leaders.nth(1).getByText('★ Лидер', { exact: true }).count(), 1);

        await card(page, 3).getByRole('button', { name: 'Удалить спортсмена' }).click();
        // Первый добавленный спортсмен получает меньший итог: порядок обязан измениться.
        await card(page, 1).getByLabel('Попытка 1', { exact: true }).fill(attempts[3]);
        await card(page, 2).getByLabel('Попытка 1', { exact: true }).fill(attempts[2]);
        assert.deepEqual(await ranking.getByRole('heading', { level: 3 }).allTextContents(), ['Спортсмен 2', 'Спортсмен 1']);
        assert.deepEqual(
          await ranking
            .locator('li')
            .getByText(/^Место:/)
            .allTextContents(),
          ['Место: 1', 'Место: 2'],
        );
        assert.equal(await ranking.locator('.calculator-leader').count(), 1);
        assert.equal(await readValue(ranking.locator('li').nth(0), 'Итог'), '40,00');
        assert.equal(await readValue(ranking.locator('li').nth(1), 'Итог'), '40,00');
        const precision = ranking.getByRole('button', { name: 'Показать точнее' });
        assert.ok((await precision.boundingBox()).height >= 44);
        await precision.click();
        assert.equal(await ranking.getByRole('button', { name: 'Скрыть точность' }).getAttribute('aria-expanded'), 'true');
        assert.equal(
          await ranking.getByText('Короткие подписи округлены. Места определены до округления.', { exact: true }).isVisible(),
          true,
        );
        assert.deepEqual(await ranking.getByText(/^Итог до округления:/).allTextContents(), [
          'Итог до округления: 40,004',
          'Итог до округления: 40,003',
        ]);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '200%';
        });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await ranking.getByRole('button', { name: 'Скрыть точность' }).click();
        assert.equal(await ranking.getByText(/^Итог до округления:/).count(), 0);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser?.close();
    await server.stop();
  }
});
