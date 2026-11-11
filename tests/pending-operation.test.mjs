import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { setTimeout } from 'node:timers/promises';
import { createStorage } from '../dist/api/storage/storage.js';
import { createOwnedOperations } from '../dist/api/access/owned-operation.js';
import { createOperationStore } from '../dist/api/operations/operation-store.js';

async function fixture(run) {
  assert.ok(process.env.TEST_DATABASE_URL, 'Нужна синтетическая PostgreSQL по README');
  const admin = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await admin.connect();
  const name = 'e005_' + randomUUID().replaceAll('-', '');
  await admin.query(`CREATE DATABASE ${name}`);
  const url = new URL(process.env.TEST_DATABASE_URL);
  url.pathname = '/' + name;
  let storage;
  try {
    const migration = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/storage.mts', 'migrate'], {
      encoding: 'utf8', env: { ...process.env, DATABASE_URL: url.toString() },
    });
    assert.equal(migration.status, 0, migration.stdout + migration.stderr);
    storage = createStorage(url.toString());
    const sessions = new Map([['session-a', { athleteId: 'athlete-a' }], ['session-b', { athleteId: 'athlete-b' }]]);
    const access = createOwnedOperations(async (credential) => sessions.get(credential) ?? null);
    await run({ storage, access, sessions, store: createOperationStore(storage, access, 'generation-a') });
  } finally {
    await storage?.$disconnect();
    await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
    await admin.end();
  }
}

test('серверный ключ черновика сохраняется и выдаётся только подтверждённому владельцу', async () => {
  await fixture(async ({ storage, access, store }) => {
    const first = await store.getDraftKey('session-a', 'athlete-a');
    const reopened = createOperationStore(storage, access, 'generation-a');
    assert.deepEqual(await reopened.getDraftKey('session-a', 'athlete-a', first.keyId), first);
    const other = await store.getDraftKey('session-b', 'athlete-b');
    assert.notEqual(other.keyId, first.keyId);
    await assert.rejects(store.getDraftKey('session-b', 'athlete-a', first.keyId), { code: 'OWNER_MISMATCH' });
    await assert.rejects(store.getDraftKey('session-a', 'athlete-a', randomUUID()), { code: 'DRAFT_KEY_MISSING' });
    assert.equal(Buffer.from(first.key, 'base64').length, 32);
  });
});

const envelope = (overrides = {}) => ({
  protocolVersion: 1, recoveryGeneration: 'generation-a', operationId: randomUUID(), athleteId: 'athlete-a',
  commandType: 'technical-change', rootId: 'synthetic-root', baseRevision: '0', occurredOn: '2026-11-11',
  payload: { text: 'неподтверждённое', weight: '60.0' }, ...overrides,
});

test('повтор после потерянного ответа возвращает историческую квитанцию до проверки редакции', async () => {
  await fixture(async ({ store }) => {
    let revision = '0';
    const handler = {
      currentRevision: async () => revision,
      apply: async () => { revision = String(Number(revision) + 1); return { revision, result: { text: 'подтверждено' } }; },
    };
    const firstCommand = envelope();
    const first = await store.execute('session-a', firstCommand, handler);
    assert.equal(first.revision, '1');
    await store.execute('session-a', envelope({ baseRevision: '1' }), handler);
    assert.deepEqual(await store.execute('session-a', firstCommand, handler), first);
    assert.equal(revision, '2');
    assert.deepEqual(await store.findReceipt('session-a', 'athlete-a', firstCommand.operationId, 'generation-a'), first);
  });
});

test('UUID не допускает другое содержимое, порядок ключей JSON не меняет команду', async () => {
  await fixture(async ({ store }) => {
    const command = envelope();
    const handler = { currentRevision: async () => '0', apply: async () => ({ revision: '1', result: { saved: true } }) };
    const first = await store.execute('session-a', command, handler);
    assert.deepEqual(await store.execute('session-a', { ...command, payload: { weight: '60.0', text: 'неподтверждённое' } }, handler), first);
    await assert.rejects(store.execute('session-a', { ...command, occurredOn: '2026-11-10' }, handler), { code: 'OPERATION_ID_CONFLICT' });
  });
});

test('прежнее или отсутствующее поколение отклоняется до квитанции и изменения', async () => {
  await fixture(async ({ storage, access, store }) => {
    const command = envelope();
    const handler = { currentRevision: async () => '0', apply: async () => ({ revision: '1', result: true }) };
    await store.execute('session-a', command, handler);
    const restored = createOperationStore(storage, access, 'generation-restored');
    await assert.rejects(restored.execute('session-a', command, handler), { code: 'RECOVERY_GENERATION_MISMATCH' });
    await assert.rejects(restored.execute('session-a', envelope({ recoveryGeneration: undefined }), handler), { code: 'RECOVERY_GENERATION_MISMATCH' });
    await assert.rejects(restored.findReceipt('session-a', 'athlete-a', command.operationId, 'generation-a'), { code: 'RECOVERY_GENERATION_MISMATCH' });
    assert.equal(await restored.findReceipt('session-a', 'athlete-a', randomUUID(), 'generation-restored'), null);
    assert.equal((await restored.execute('session-a', envelope({ recoveryGeneration: 'generation-restored' }), handler)).revision, '1');
  });
});

test('повреждённый envelope отклоняется безопасно без применения', async () => {
  await fixture(async ({ store }) => {
    const handler = { currentRevision: async () => '0', apply: async () => { throw new Error('должен быть недоступен'); } };
    for (const command of [null, envelope({ operationId: 'bad' }), envelope({ payload: { weight: NaN } }), envelope({ protocolVersion: 2 }), envelope({ recoveryGeneration: () => 'invalid' }), envelope({ payload: Array(1) })]) {
      await assert.rejects(async () => store.execute('session-a', command, handler), { code: 'INVALID_OPERATION' });
    }
  });
});

async function technicalRecord(storage, access) {
  await storage.$executeRaw`CREATE TABLE evidence (owner text PRIMARY KEY, revision integer NOT NULL, value text NOT NULL)`;
  await storage.$executeRaw`INSERT INTO evidence VALUES ('athlete-a', 0, 'исходное')`;
  return {
    currentRevision: async (tx, owner) => String((await tx.$queryRaw`SELECT revision FROM evidence WHERE owner = ${owner.athleteId}`)[0].revision),
    apply: async (tx, owner, command) => {
      const [row] = await tx.$queryRaw`UPDATE evidence SET revision = revision + 1, value = ${command.payload.text} WHERE owner = ${owner.athleteId} RETURNING revision, value`;
      return { revision: String(row.revision), result: { text: row.value } };
    },
    read: () => access.run('session-a', 'athlete-a', async (owner) => {
      const [row] = await storage.$queryRaw`SELECT revision, value FROM evidence WHERE owner = ${owner.athleteId}`;
      return row;
    }),
  };
}

test('откат объединяет изменение и квитанцию; тот же UUID затем можно применить', async () => {
  await fixture(async ({ storage, access, store }) => {
    const record = await technicalRecord(storage, access);
    const command = envelope();
    await assert.rejects(store.execute('session-a', command, {
      ...record, apply: async (...args) => { await record.apply(...args); throw new Error('controlled-failure'); },
    }));
    assert.deepEqual(await record.read(), { revision: 0, value: 'исходное' });
    assert.equal(await store.findReceipt('session-a', 'athlete-a', command.operationId, 'generation-a'), null);
    assert.equal((await store.execute('session-a', command, record)).revision, '1');
    assert.deepEqual(await record.read(), { revision: 1, value: 'неподтверждённое' });
  });
});

test('конкурентный повтор одного UUID изменяет техническую запись один раз', async () => {
  await fixture(async ({ storage, access, store }) => {
    const record = await technicalRecord(storage, access);
    const command = envelope();
    const results = await Promise.all([store.execute('session-a', command, record), store.execute('session-a', command, record)]);
    assert.deepEqual(results[0], results[1]);
    assert.deepEqual(await record.read(), { revision: 1, value: 'неподтверждённое' });
  });
});

test('команда фиксирует проверенный snapshot и не принимает дополнительные поля', async () => {
  await fixture(async ({ store }) => {
    const command = envelope();
    const handler = {
      currentRevision: async () => { command.payload.text = 'поздняя подмена'; return '0'; },
      apply: async (_tx, _owner, accepted) => {
        assert.throws(() => { accepted.payload.text = 'подмена обработчика'; }, TypeError);
        return { revision: '1', result: accepted.payload };
      },
    };
    assert.equal((await store.execute('session-a', command, handler)).result.text, 'неподтверждённое');
    await assert.rejects(store.execute('session-a', envelope({ secret: 'не поле протокола' }), handler), { code: 'INVALID_OPERATION' });
  });
});

test('сериализационные отказы повторяются ограниченно и не раскрывают SQL', async () => {
  await fixture(async ({ storage, access, store }) => {
    const record = await technicalRecord(storage, access);
    let attempts = 0;
    await assert.rejects(store.execute('session-a', envelope(), {
      ...record, apply: async (tx) => {
        attempts++;
        await tx.$executeRaw`DO $$ BEGIN RAISE EXCEPTION 'synthetic-secret' USING ERRCODE = '40001'; END $$`;
        return { revision: '1', result: null };
      },
    }), { code: 'OPERATION_FAILED', message: 'OPERATION_FAILED' });
    assert.equal(attempts, 3);
    assert.deepEqual(await record.read(), { revision: 0, value: 'исходное' });
  });
});

test('отказ хранилища ключей и квитанций не раскрывает исходное исключение', async () => {
  const storage = createStorage('postgresql://secret:secret@127.0.0.1:1/private');
  const access = createOwnedOperations(async () => ({ athleteId: 'athlete-a' }));
  const store = createOperationStore(storage, access, 'generation-a');
  try {
    await assert.rejects(store.getDraftKey('session-a', 'athlete-a'), { code: 'OPERATION_FAILED', message: 'OPERATION_FAILED' });
    await assert.rejects(store.findReceipt('session-a', 'athlete-a', randomUUID(), 'generation-a'), { code: 'OPERATION_FAILED', message: 'OPERATION_FAILED' });
  } finally { await storage.$disconnect(); }
});

test('отзыв доступа во время ожидания блокировки не пропускает команду', async () => {
  await fixture(async ({ storage, access, sessions, store }) => {
    const record = await technicalRecord(storage, access);
    let release;
    let ready;
    const locked = new Promise((done) => { ready = done; });
    const holding = storage.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('athlete-a', 0))::text`;
      ready(); await new Promise((done) => { release = done; });
    });
    await locked;
    const pending = store.execute('session-a', envelope(), record);
    await setTimeout(80);
    sessions.delete('session-a');
    release(); await holding;
    await assert.rejects(pending, { code: 'ACCESS_REQUIRED' });
    sessions.set('session-a', { athleteId: 'athlete-a' });
    assert.deepEqual(await record.read(), { revision: 0, value: 'исходное' });
  });
});
