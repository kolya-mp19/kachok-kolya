import test from 'node:test';
import assert from 'node:assert/strict';
import { createOwnedOperations } from '../dist/api/access/owned-operation.js';

test('личная операция получает владельца подтверждённого доступа', async () => {
  const sessions = new Map([['session-a', { athleteId: 'athlete-a' }]]);
  const operations = createOwnedOperations(async (credential) => sessions.get(credential) ?? null);
  const result = await operations.run('session-a', 'athlete-a', async (owner) => ({ owner: owner.athleteId }));
  assert.deepEqual(result, { owner: 'athlete-a' });
});

test('идентификатор атлета из недоверенного JSON не открывает личную операцию', async () => {
  const sessions = new Map([['session-a', { athleteId: 'athlete-a' }]]);
  const operations = createOwnedOperations(async (credential) => sessions.get(credential) ?? null);
  const credential = JSON.parse('{"athleteId":"athlete-a"}');
  let value = 'исходное';
  await assert.rejects(
    operations.run(credential, 'athlete-a', async () => {
      value = 'изменено';
    }),
    { code: 'ACCESS_REQUIRED' },
  );
  assert.equal(value, 'исходное');
});

test('подтверждённый доступ не позволяет выполнить команду другого владельца', async () => {
  const operations = createOwnedOperations(async () => ({ athleteId: 'athlete-a' }));
  let value = 'исходное';
  await assert.rejects(
    operations.run('session-a', 'athlete-b', async () => {
      value = 'изменено';
    }),
    { code: 'OWNER_MISMATCH' },
  );
  assert.equal(value, 'исходное');
});

test('контекст операции не позволяет заменить подтверждённого владельца', async () => {
  const access = { athleteId: 'athlete-a' };
  const operations = createOwnedOperations(async () => access);
  const result = await operations.run('session-a', 'athlete-a', async (owner) => {
    access.athleteId = 'athlete-b';
    assert.throws(() => {
      owner.athleteId = 'athlete-b';
    }, TypeError);
    return owner.athleteId;
  });
  assert.equal(result, 'athlete-a');
});

test('отсутствующий владелец адаптера не становится подтверждением доступа', async () => {
  const operations = createOwnedOperations(async () => ({}));
  let value = 'исходное';
  await assert.rejects(
    operations.run(undefined, undefined, async () => {
      value = 'изменено';
    }),
    { code: 'ACCESS_REQUIRED' },
  );
  assert.equal(value, 'исходное');
});

test('отозванный доступ нельзя повторно использовать в той же границе', async () => {
  const sessions = new Map([['session-a', { athleteId: 'athlete-a' }]]);
  const operations = createOwnedOperations(async (credential) => sessions.get(credential) ?? null);
  assert.equal(await operations.run('session-a', 'athlete-a', async (owner) => owner.athleteId), 'athlete-a');
  sessions.delete('session-a');
  let value = 'исходное';
  await assert.rejects(
    operations.run('session-a', 'athlete-a', async () => {
      value = 'изменено';
    }),
    { code: 'ACCESS_REQUIRED' },
  );
  assert.equal(value, 'исходное');
});
