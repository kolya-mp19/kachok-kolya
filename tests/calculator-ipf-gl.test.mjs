import test from 'node:test';
import assert from 'node:assert/strict';
import { tsImport } from 'tsx/esm/api';

const { calculateComparison } = await tsImport('../apps/web/src/calculator/engine/calculate-comparison.ts', import.meta.url);

test('IPF GL Classic Powerlifting совпадает с независимыми протоколами обоих полов', () => {
  // GOODLIFT, World Classic Championships 2021: Orhii (cid586), Bavoil (cid585).
  const examples = [
    { sex: 'male', bodyWeight: '82.62', attempt: '841', coefficient: 0.1387, score: 116.687 },
    { sex: 'female', bodyWeight: '62.86', attempt: '548', coefficient: 0.2191, score: 120.065 },
  ];
  for (const example of examples) {
    const [row] = calculateComparison({
      formula: 'ipf-gl',
      participants: [
        { id: 'reference', additionOrder: 0, sex: example.sex, bodyWeight: example.bodyWeight, attempts: [example.attempt] },
      ],
    });
    assert.ok(Math.abs(row.coefficient - example.coefficient) < 0.00005);
    assert.ok(Math.abs(row.score - example.score) < 0.001);
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

test('смена общей формулы пересчитывает коэффициенты, итоги, равные места и лидеров', () => {
  const participants = Object.freeze([
    Object.freeze(participant({ id: 'man', attempts: Object.freeze(['50']) })),
    Object.freeze(
      participant({ id: 'woman-first', additionOrder: 1, sex: 'female', bodyWeight: '60', attempts: Object.freeze(['31']) }),
    ),
    Object.freeze(
      participant({ id: 'woman-second', additionOrder: 2, sex: 'female', bodyWeight: '60', attempts: Object.freeze(['31']) }),
    ),
  ]);
  const before = structuredClone(participants);
  const wilks = calculateComparison({ participants });
  const ipfGl = calculateComparison({ formula: 'ipf-gl', participants });
  assert.deepEqual(
    wilks.map(({ id, place, isLeader }) => [id, place, isLeader]),
    [
      ['woman-first', 1, true],
      ['woman-second', 1, true],
      ['man', 3, false],
    ],
  );
  assert.deepEqual(
    ipfGl.map(({ id, place, isLeader }) => [id, place, isLeader]),
    [
      ['man', 1, true],
      ['woman-first', 2, false],
      ['woman-second', 2, false],
    ],
  );
  for (const previous of wilks) {
    const current = ipfGl.find(({ id }) => id === previous.id);
    assert.notEqual(current.coefficient, previous.coefficient);
    assert.notEqual(current.score, previous.score);
    assert.equal(current.bestAttempt, previous.bestAttempt);
  }
  assert.deepEqual(calculateComparison({ formula: 'wilks', participants }), wilks);
  assert.deepEqual(participants, before);
});

test('IPF GL сохраняет неполные и неконечные строки, не блокируя полный расчёт', () => {
  const rows = calculateComparison({
    formula: 'ipf-gl',
    participants: [
      participant({ id: 'missing-sex', sex: null }),
      participant({ id: 'missing-weight', additionOrder: 1, bodyWeight: '' }),
      participant({ id: 'missing-attempt', additionOrder: 2, attempts: [] }),
      participant({ id: 'overflow', additionOrder: 3, sex: 'female', bodyWeight: '17.7', attempts: [Number.MAX_VALUE] }),
      participant({ id: 'valid', additionOrder: 4 }),
    ],
  });
  assert.equal(rows.length, 5);
  assert.equal(rows[0].id, 'valid');
  assert.equal(rows[0].place, 1);
  assert.equal(rows[0].isLeader, true);
  assert.deepEqual(
    rows.slice(1).map(({ id, coefficient, score, place, isLeader }) => [id, coefficient, score, place, isLeader]),
    [
      ['missing-sex', null, null, null, false],
      ['missing-weight', null, null, null, false],
      ['missing-attempt', null, null, null, false],
      ['overflow', null, null, null, false],
    ],
  );
  assert.deepEqual(
    rows.slice(1).map(({ bestAttempt }) => bestAttempt),
    [50, 50, null, Number.MAX_VALUE],
  );
});

test('адаптация IPF GL не применяет спортивные пороги положительного собственного веса', () => {
  const examples = [
    { sex: 'male', bodyWeight: '20', coefficient: 0.288 },
    { sex: 'male', bodyWeight: '210', coefficient: 0.095 },
    { sex: 'female', bodyWeight: '17,7', coefficient: 142.167 },
    { sex: 'female', bodyWeight: '18', coefficient: 15.994 },
    { sex: 'female', bodyWeight: '20', coefficient: 2.382 },
  ];
  // Независимые контрольные коэффициенты из calculator §8; источник округлён до 0.001.
  for (const example of examples) {
    const [row] = calculateComparison({ formula: 'ipf-gl', participants: [participant(example)] });
    assert.ok(Math.abs(row.coefficient - example.coefficient) < 0.0005);
    assert.equal(row.place, 1);
  }
});
