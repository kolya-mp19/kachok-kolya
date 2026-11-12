import test from 'node:test';
import assert from 'node:assert/strict';
import { tsImport } from 'tsx/esm/api';

const { calculateComparison } = await tsImport('../apps/web/src/calculator/engine/calculate-comparison.ts', import.meta.url);

test('DOTS совпадает с независимыми официальными протоколами обоих полов', () => {
  // BVDK/BGKV, Bayerische Meisterschaften KDK Classic JJA 2022, стр. 1–2.
  const examples = [
    { sex: 'female', bodyWeight: '58.0', attempt: '250.5', score: 283.7692 },
    { sex: 'female', bodyWeight: '86.2', attempt: '308.5', score: 280.4493 },
    { sex: 'male', bodyWeight: '74.1', attempt: '442.5', score: 319.9355 },
    { sex: 'male', bodyWeight: '85.3', attempt: '520.5', score: 346.1222 },
  ];
  for (const example of examples) {
    const [row] = calculateComparison({
      formula: 'dots',
      participants: [
        { id: 'reference', additionOrder: 0, sex: example.sex, bodyWeight: example.bodyWeight, attempts: [example.attempt] },
      ],
    });
    assert.ok(Math.abs(row.score - example.score) < 0.00005);
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

test('переключение на DOTS заново определяет коэффициенты, итоги, места и лидеров всей сессии', () => {
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
  const dots = calculateComparison({ formula: 'dots', participants });
  assert.deepEqual(
    wilks.map(({ id, place, isLeader }) => [id, place, isLeader]),
    [
      ['woman-first', 1, true],
      ['woman-second', 1, true],
      ['man', 3, false],
    ],
  );
  assert.deepEqual(
    dots.map(({ id, place, isLeader }) => [id, place, isLeader]),
    [
      ['man', 1, true],
      ['woman-first', 2, false],
      ['woman-second', 2, false],
    ],
  );
  for (const formula of ['wilks', 'ipf-gl']) {
    const previous = calculateComparison({ formula, participants });
    for (const current of dots) {
      const previousRow = previous.find(({ id }) => id === current.id);
      assert.notEqual(current.coefficient, previousRow.coefficient);
      assert.notEqual(current.score, previousRow.score);
      assert.equal(current.bestAttempt, previousRow.bestAttempt);
    }
    assert.deepEqual(calculateComparison({ formula, participants }), previous);
  }
  assert.deepEqual(participants, before);
});

test('DOTS оставляет неполные и неконечные карточки без места и сохраняет остальные расчёты', () => {
  const rows = calculateComparison({
    formula: 'dots',
    participants: [
      participant({ id: 'no-sex', sex: null }),
      participant({ id: 'no-weight', additionOrder: 1, bodyWeight: 'bad' }),
      participant({ id: 'no-attempt', additionOrder: 2, attempts: ['', '0', '-1'] }),
      participant({ id: 'overflow-polynomial', additionOrder: 3, bodyWeight: Number.MAX_VALUE }),
      participant({ id: 'overflow-score', additionOrder: 4, sex: 'female', bodyWeight: '58', attempts: [Number.MAX_VALUE] }),
      participant({ id: 'valid', additionOrder: 5 }),
    ],
  });
  assert.equal(rows.length, 6);
  assert.equal(rows[0].id, 'valid');
  assert.equal(rows[0].place, 1);
  assert.equal(rows[0].isLeader, true);
  assert.deepEqual(
    rows.slice(1).map(({ id, coefficient, score, place, isLeader }) => [id, coefficient, score, place, isLeader]),
    [
      ['no-sex', null, null, null, false],
      ['no-weight', null, null, null, false],
      ['no-attempt', null, null, null, false],
      ['overflow-polynomial', null, null, null, false],
      ['overflow-score', null, null, null, false],
    ],
  );
  assert.deepEqual(
    rows.slice(1).map(({ bestAttempt }) => bestAttempt),
    [50, 50, null, 50, Number.MAX_VALUE],
  );
});

test('DOTS экстраполируется за авторские диапазоны без подмены положительного собственного веса', () => {
  for (const sex of ['male', 'female']) {
    const upperBoundary = sex === 'male' ? 210 : 150;
    for (const [bodyWeight, boundaryWeight] of [
      [20, 40],
      [400, upperBoundary],
    ]) {
      const [row] = calculateComparison({ formula: 'dots', participants: [participant({ sex, bodyWeight })] });
      const [boundary] = calculateComparison({
        formula: 'dots',
        participants: [participant({ sex, bodyWeight: boundaryWeight })],
      });
      assert.equal(row.bodyWeight, bodyWeight);
      assert.ok(Number.isFinite(row.coefficient));
      assert.ok(Number.isFinite(row.score));
      assert.notEqual(row.coefficient, boundary.coefficient);
      assert.equal(row.place, 1);
      assert.equal(row.isLeader, true);
      if (bodyWeight === 400) {
        assert.ok(row.coefficient < 0);
        assert.ok(row.score < 0);
      }
    }
  }
});
