import test from 'node:test';
import assert from 'node:assert/strict';
import { tsImport } from 'tsx/esm/api';

const { calculateComparison } = await tsImport('../apps/web/src/calculator/engine/calculate-comparison.ts', import.meta.url);

test('оригинальный Уилкс совпадает с независимой таблицей для обоих полов', () => {
  // Wilks coefficients, Moscow 2016: стр. 4 (45.5), 6 (80), 14 (60), 15 (80).
  const examples = [
    { sex: 'male', bodyWeight: '45.5', coefficient: 1.1382 },
    { sex: 'male', bodyWeight: '80', coefficient: 0.6827 },
    { sex: 'female', bodyWeight: '60', coefficient: 1.1149 },
    { sex: 'female', bodyWeight: '80', coefficient: 0.915 },
  ];
  for (const example of examples) {
    const [row] = calculateComparison({
      participants: [{ id: 'reference', additionOrder: 0, ...example, attempts: ['50'] }],
    });
    assert.ok(Math.abs(row.coefficient - example.coefficient) < 0.00005);
    assert.ok(Math.abs(row.score - example.coefficient * 50) < 0.0025);
    assert.equal(row.bestAttempt, 50);
    assert.equal(row.place, 1);
    assert.equal(row.isLeader, true);
  }
});

const participant = (overrides = {}) => ({
  id: 'participant',
  additionOrder: 0,
  sex: 'male',
  bodyWeight: '80',
  attempts: ['50'],
  ...overrides,
});

test('точка и запятая равнозначны, входные карточки и попытки не изменяются', () => {
  const participants = Object.freeze([
    Object.freeze(participant({ id: 'comma', bodyWeight: '82,5', attempts: Object.freeze(['40', '52,5', '51']) })),
    Object.freeze(participant({ id: 'dot', additionOrder: 1, bodyWeight: '82.5', attempts: Object.freeze([40, 52.5, 51]) })),
  ]);
  const before = structuredClone(participants);
  const rows = calculateComparison({ participants });
  assert.deepEqual(participants, before);
  assert.equal(rows[0].bodyWeight, 82.5);
  assert.equal(rows[0].bestAttempt, 52.5);
  assert.equal(rows[0].score, rows[1].score);
  assert.deepEqual(
    rows.map(({ id, place }) => [id, place]),
    [
      ['comma', 1],
      ['dot', 1],
    ],
  );
});

test('недопустимый ввод отсутствует и не мешает расчёту других карточек', () => {
  const invalidValues = ['', ' ', 'текст', '50kg', '1,2.3', '0x50', 'NaN', 'Infinity', null, undefined, 0, -5, NaN, Infinity];
  for (const value of invalidValues) {
    const rows = calculateComparison({
      participants: [
        participant({ id: 'invalid-weight', bodyWeight: value }),
        participant({ id: 'invalid-attempt', additionOrder: 1, attempts: [value] }),
        participant({ id: 'valid', additionOrder: 2 }),
      ],
    });
    assert.equal(rows[0].id, 'valid');
    assert.equal(rows[0].place, 1);
    assert.equal(rows[1].bodyWeight, null);
    assert.equal(rows[1].bestAttempt, 50);
    assert.equal(rows[2].bestAttempt, null);
    for (const row of rows.slice(1)) {
      assert.equal(row.coefficient, null);
      assert.equal(row.score, null);
      assert.equal(row.place, null);
      assert.equal(row.isLeader, false);
    }
  }
});

test('лучшая попытка доступна без пола или собственного веса, без попытки коэффициента нет', () => {
  const rows = calculateComparison({
    participants: [
      participant({ sex: null, attempts: ['40', '-20', '45,5'] }),
      participant({ id: 'no-weight', additionOrder: 1, bodyWeight: null, attempts: ['bad', '45.5', ''] }),
      participant({ id: 'no-attempt', additionOrder: 2, attempts: [] }),
    ],
  });
  assert.deepEqual(
    rows.map(({ bestAttempt, coefficient, score, place, isLeader }) => [bestAttempt, coefficient, score, place, isLeader]),
    [
      [45.5, null, null, null, false],
      [45.5, null, null, null, false],
      [null, null, null, null, false],
    ],
  );
});

test('ничьи дают общие места с пропусками и сохраняют порядок добавления', () => {
  const rows = calculateComparison({
    participants: [
      participant({ id: 'later-tie', additionOrder: 4, attempts: ['50', '40'] }),
      participant({ id: 'missing-later', additionOrder: 8, sex: null }),
      participant({ id: 'third', additionOrder: 5, attempts: ['49'] }),
      participant({ id: 'first-tie', additionOrder: 2, attempts: ['50'] }),
      participant({ id: 'missing-first', additionOrder: 0, bodyWeight: '' }),
    ],
  });
  assert.deepEqual(
    rows.map(({ id, place, isLeader }) => [id, place, isLeader]),
    [
      ['first-tie', 1, true],
      ['later-tie', 1, true],
      ['third', 3, false],
      ['missing-first', null, false],
      ['missing-later', null, false],
    ],
  );
  const secondPlaceTie = calculateComparison({
    participants: [
      participant({ attempts: ['51'] }),
      participant({ id: 'second', additionOrder: 1 }),
      participant({ id: 'second-tie', additionOrder: 2 }),
      participant({ id: 'fourth', additionOrder: 3, attempts: ['49'] }),
    ],
  });
  assert.deepEqual(
    secondPlaceTie.map(({ place }) => place),
    [1, 2, 2, 4],
  );
});

test('совпадающие короткие подписи не создают ничью и повторный расчёт использует актуальный ввод', () => {
  const participants = [
    participant({ id: 'first', attempts: ['50'] }),
    participant({ id: 'second', additionOrder: 1, attempts: ['50.00001'] }),
  ];
  const rows = calculateComparison({ formula: 'wilks', participants });
  assert.equal(rows[0].score.toFixed(2), rows[1].score.toFixed(2));
  assert.deepEqual(
    rows.map(({ id, place, isLeader }) => [id, place, isLeader]),
    [
      ['second', 1, true],
      ['first', 2, false],
    ],
  );
  participants[0].attempts = ['55'];
  const recalculated = calculateComparison({ participants });
  assert.equal(recalculated[0].id, 'first');
  assert.equal(recalculated[0].isLeader, true);
  assert.equal(recalculated[1].isLeader, false);
  assert.equal(rows[0].id, 'second');
});

test('края положительного собственного веса и отрицательные коэффициенты не ограничиваются', () => {
  // Независимые значения из calculator §8; точность источника — три десятичных знака.
  const examples = [
    [150, 0.769],
    [200, 1.885],
    [205, 4.214],
    [208, 40.003],
    [210, -7.496],
  ];
  for (const [bodyWeight, coefficient] of examples) {
    const [row] = calculateComparison({ participants: [participant({ sex: 'female', bodyWeight })] });
    assert.ok(Math.abs(row.coefficient - coefficient) < 0.0005);
    assert.equal(row.place, 1);
    assert.equal(row.isLeader, true);
  }
  for (const bodyWeight of [Number.MIN_VALUE, 1, 20, 250, 1000]) {
    const [row] = calculateComparison({ participants: [participant({ bodyWeight })] });
    assert.ok(Number.isFinite(row.coefficient));
    assert.ok(Number.isFinite(row.score));
    assert.equal(row.place, 1);
  }
});

test('неконечный расчёт скрывает обе величины, сохраняя попытку и остальные карточки', () => {
  const rows = calculateComparison({
    participants: [
      participant({ id: 'overflow-polynomial', bodyWeight: Number.MAX_VALUE }),
      participant({ id: 'overflow-score', additionOrder: 1, sex: 'female', bodyWeight: 208, attempts: [Number.MAX_VALUE] }),
      participant({ id: 'valid', additionOrder: 2 }),
    ],
  });
  assert.equal(rows[0].id, 'valid');
  assert.equal(rows[0].place, 1);
  assert.deepEqual(
    rows.slice(1).map(({ coefficient, score, place, isLeader }) => [coefficient, score, place, isLeader]),
    [
      [null, null, null, false],
      [null, null, null, false],
    ],
  );
  assert.equal(rows[1].bestAttempt, 50);
  assert.equal(rows[2].bestAttempt, Number.MAX_VALUE);
  assert.deepEqual(calculateComparison({ participants: [] }), []);
});
