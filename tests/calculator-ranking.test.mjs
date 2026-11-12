import test from 'node:test';
import assert from 'node:assert/strict';
import { tsImport } from 'tsx/esm/api';

const { calculateComparison } = await tsImport('../apps/web/src/calculator/engine/calculate-comparison.ts', import.meta.url);

// Подготовленные входы для точных итогов PRD в number IEEE 754 при собственном весе 80 кг.
// Ожидания — литералы из PRD; тест не вычисляет их через формулу или коэффициент ядра.
// Независимую точность самих формул проверяют calculator-engine/ipf-gl/dots.test.mjs.
const rankingCases = [
  { formula: 'wilks', sex: 'male', attempts: [58.591010112, 57.1262348592, 58.596869213011196, 58.5954044377584] },
  { formula: 'wilks', sex: 'female', attempts: [43.71542791857768, 42.62254222061324, 43.71979946136953, 43.718706575671575] },
  { formula: 'ipf-gl', sex: 'male', attempts: [283.61290208671755, 276.5225795345496, 283.6412633769262, 283.63417305437406] },
  {
    formula: 'ipf-gl',
    sex: 'female',
    attempts: [207.61890687790995, 202.42843420596222, 207.63966876859774, 207.63447829592582],
  },
  { formula: 'dots', sex: 'male', attempts: [58.0091446528, 56.55891603648001, 58.01494556726528, 58.013495338648966] },
  { formula: 'dots', sex: 'female', attempts: [42.45158118399999, 41.39029165439999, 42.455826342118385, 42.45476505258879] },
];

function participant(overrides = {}) {
  return { id: 'participant', additionOrder: 0, sex: 'male', bodyWeight: 80, attempts: [50], ...overrides };
}

for (const { formula, sex, attempts } of rankingCases) {
  test(`${formula}/${sex}: точные 40; 40; 39 дают 1; 1; 3, порядок добавления и полный рейтинг`, () => {
    const rows = calculateComparison({
      formula,
      participants: [
        participant({ id: 'tie-later', additionOrder: 6, sex, attempts: [attempts[0], 1, 'bad'] }),
        participant({ id: 'missing-later', additionOrder: 9, sex: null }),
        participant({ id: 'third', additionOrder: 1, sex, attempts: [attempts[1]] }),
        participant({ id: 'tie-first', additionOrder: 3, sex, attempts: [attempts[0]] }),
        participant({ id: 'missing-first', additionOrder: 0, bodyWeight: '' }),
      ],
    });
    assert.deepEqual(
      rows.map(({ id, score, place, isLeader }) => [id, score, place, isLeader]),
      [
        ['tie-first', 40, 1, true],
        ['tie-later', 40, 1, true],
        ['third', 39, 3, false],
        ['missing-first', null, null, false],
        ['missing-later', null, null, false],
      ],
    );
  });

  test(`${formula}/${sex}: точные 40.004; 40.003 не становятся ничьей после короткой подписи`, () => {
    const rows = calculateComparison({
      formula,
      participants: [
        participant({ id: 'second', sex, attempts: [attempts[3]] }),
        participant({ id: 'first', additionOrder: 1, sex, attempts: [attempts[2]] }),
      ],
    });
    assert.deepEqual(
      rows.map(({ id, score, place, isLeader }) => [id, score, place, isLeader]),
      [
        ['first', 40.004, 1, true],
        ['second', 40.003, 2, false],
      ],
    );
    assert.deepEqual(
      rows.map(({ score }) => score.toFixed(2)),
      ['40.00', '40.00'],
    );
  });
}

const boundaryCases = [
  { formula: 'wilks', sex: 'male', negativeWeight: 1, growthWeights: [20, 13.5], overflowWeight: 13.5 },
  { formula: 'wilks', sex: 'female', negativeWeight: 210, growthWeights: [200, 208], overflowWeight: 208 },
  { formula: 'dots', sex: 'male', negativeWeight: 1, growthWeights: [20, 14.5], overflowWeight: 14.5 },
  { formula: 'dots', sex: 'female', negativeWeight: 4, growthWeights: [20, 5], overflowWeight: 5 },
  { formula: 'ipf-gl', sex: 'female', negativeWeight: 17, growthWeights: [20, 17.663], overflowWeight: 17.663 },
];

for (const { formula, sex, negativeWeight, growthWeights, overflowWeight } of boundaryCases) {
  test(`${formula}/${sex}: допустимые края и рост сохраняются, отрицательный итог ранжируется, неконечный отсутствует`, () => {
    const rows = calculateComparison({
      formula,
      participants: [
        participant({ id: 'negative', sex, bodyWeight: negativeWeight }),
        participant({ id: 'missing', additionOrder: 1, sex: null }),
        participant({ id: 'overflow', additionOrder: 2, sex, bodyWeight: overflowWeight, attempts: [Number.MAX_VALUE] }),
        participant({ id: 'positive', additionOrder: 3, sex, bodyWeight: 80 }),
      ],
    });
    assert.deepEqual(
      rows.map(({ id, place, isLeader }) => [id, place, isLeader]),
      [
        ['positive', 1, true],
        ['negative', 2, false],
        ['missing', null, false],
        ['overflow', null, false],
      ],
    );
    assert.ok(rows[1].coefficient < 0);
    assert.ok(Number.isFinite(rows[1].score));
    assert.equal(rows[3].coefficient, null);
    assert.equal(rows[3].score, null);
    assert.equal(rows[3].bestAttempt, Number.MAX_VALUE);

    const growth = growthWeights.map(
      (bodyWeight) =>
        calculateComparison({
          formula,
          participants: [participant({ sex, bodyWeight })],
        })[0],
    );
    assert.ok(growth[1].coefficient > growth[0].coefficient * 10);
    assert.equal(growth[1].place, 1);
    assert.equal(growth[1].isLeader, true);

    for (const bodyWeight of [Number.MIN_VALUE, 1, 250, 1000]) {
      const [row] = calculateComparison({ formula, participants: [participant({ sex, bodyWeight })] });
      assert.equal(row.bodyWeight, bodyWeight);
      assert.ok(Number.isFinite(row.coefficient));
      assert.ok(Number.isFinite(row.score));
      assert.equal(row.place, 1);
    }
    const [largest] = calculateComparison({ formula, participants: [participant({ sex, bodyWeight: Number.MAX_VALUE })] });
    assert.equal(largest.bodyWeight, Number.MAX_VALUE);
    if (formula === 'ipf-gl') {
      assert.ok(Number.isFinite(largest.score));
      assert.equal(largest.place, 1);
    } else {
      assert.equal(largest.coefficient, null);
      assert.equal(largest.score, null);
      assert.equal(largest.place, null);
      assert.equal(largest.isLeader, false);
    }
  });
}

test('IPF GL/мужской: коэффициент положителен и ограничен при любом положительном весе', () => {
  // A > B > 0 и C > 0: при x > 0 знаменатель A - B*exp(-C*x) >= A-B.
  // Верхняя граница коэффициента < 0.573, поэтому даже MAX_VALUE не переполняет итог.
  let previousCoefficient = Infinity;
  for (const bodyWeight of [Number.MIN_VALUE, 1, 20, 80, 210, 1000, Number.MAX_VALUE]) {
    const [row] = calculateComparison({
      formula: 'ipf-gl',
      participants: [participant({ bodyWeight, attempts: [Number.MAX_VALUE] })],
    });
    assert.equal(row.bodyWeight, bodyWeight);
    assert.ok(row.coefficient > 0 && row.coefficient < 0.573);
    assert.ok(row.coefficient <= previousCoefficient);
    assert.ok(Number.isFinite(row.score));
    assert.equal(row.place, 1);
    assert.equal(row.isLeader, true);
    previousCoefficient = row.coefficient;
  }
});

for (const formula of ['wilks', 'ipf-gl', 'dots']) {
  test(`${formula}: конечный нулевой итог занимает место между положительным и отрицательным`, () => {
    const negativeWeights = { wilks: 210, 'ipf-gl': 17, dots: 4 };
    const rows = calculateComparison({
      formula,
      participants: [
        participant({ id: 'negative', sex: 'female', bodyWeight: negativeWeights[formula] }),
        participant({ id: 'zero', additionOrder: 1, bodyWeight: 1000, attempts: [Number.MIN_VALUE] }),
        participant({ id: 'missing', additionOrder: 2, attempts: [] }),
        participant({ id: 'positive', additionOrder: 3 }),
      ],
    });
    assert.deepEqual(
      rows.map(({ id, place, isLeader }) => [id, place, isLeader]),
      [
        ['positive', 1, true],
        ['zero', 2, false],
        ['negative', 3, false],
        ['missing', null, false],
      ],
    );
    // У полиномов здесь получается -0, у IPF GL +0: оба являются рассчитанным нулём.
    assert.ok(rows[1].score === 0);
    assert.notEqual(rows[1].coefficient, null);
    const onlyNegative = calculateComparison({
      formula,
      participants: [participant({ sex: 'female', bodyWeight: negativeWeights[formula] })],
    });
    assert.equal(onlyNegative[0].place, 1);
    assert.equal(onlyNegative[0].isLeader, true);
  });

  test(`${formula}: при отсутствии итогов нет мест и лидеров, добавление и десятичный ввод сохраняются`, () => {
    const emptyRows = calculateComparison({
      formula,
      participants: [
        participant({ id: 'later', additionOrder: 2, attempts: ['0', '-5', 'bad'] }),
        participant({ id: 'first', additionOrder: 0, sex: null }),
        participant({ id: 'middle', additionOrder: 1, bodyWeight: '' }),
      ],
    });
    assert.deepEqual(
      emptyRows.map(({ id, coefficient, score, place, isLeader }) => [id, coefficient, score, place, isLeader]),
      [
        ['first', null, null, null, false],
        ['middle', null, null, null, false],
        ['later', null, null, null, false],
      ],
    );
    const equalRows = calculateComparison({
      formula,
      participants: [
        participant({ id: 'comma', bodyWeight: '82,5', attempts: ['50,5'] }),
        participant({ id: 'dot', additionOrder: 1, bodyWeight: '82.5', attempts: ['50.5'] }),
      ],
    });
    assert.equal(equalRows[0].score, equalRows[1].score);
    assert.deepEqual(
      equalRows.map(({ place, isLeader }) => [place, isLeader]),
      [
        [1, true],
        [1, true],
      ],
    );
  });
}

test('полюс женского IPF GL скрывает коэффициент и итог, но сохраняет лучшую попытку', () => {
  // В number это корень знаменателя из опубликованных коэффициентов: ln(B/A)/C.
  const [row] = calculateComparison({
    formula: 'ipf-gl',
    participants: [participant({ sex: 'female', bodyWeight: 17.662166777571205 })],
  });
  assert.equal(row.bodyWeight, 17.662166777571205);
  assert.equal(row.bestAttempt, 50);
  assert.equal(row.coefficient, null);
  assert.equal(row.score, null);
  assert.equal(row.place, null);
  assert.equal(row.isLeader, false);
});
