import test from 'node:test';
import assert from 'node:assert/strict';
import { startLocalServer } from './helpers/local-server.mjs';
import { launchBrowser } from './helpers/browser.mjs';

test('зашифрованный неподтверждённый ввод через публичный браузерный механизм', { timeout: 60000 }, async (t) => {
  const server = await startLocalServer({
    arguments_: ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '3020', '--strictPort'],
    port: 3020,
  });
  const { origin } = server;
  let browser;
  try {
    browser = await launchBrowser();
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(origin);
    await page.evaluate(async () => {
      window.pending = await import('/src/diary/pending-input.ts');
      window.keyMaterial = {
        athleteId: 'athlete-a',
        keyId: crypto.randomUUID(),
        key: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))),
        recoveryGeneration: 'generation-a',
      };
    });
    await t.test('черновик восстанавливается после закрытия соединения без открытого текста в IndexedDB', async () => {
      const result = await page.evaluate(async () => {
        const session = await window.pending.openPendingInput(window.keyMaterial);
        const editor = await session.openEditor('draft-one', '0');
        await editor.edit({ notation: '60*', comment: 'личное' });
        await session.close();
        const reopened = await window.pending.openPendingInput(window.keyMaterial);
        const restored = await reopened.openEditor('draft-one', '0');
        const snapshot = restored.snapshot();
        await reopened.close();
        return snapshot;
      });
      assert.deepEqual(result.fields, { notation: '60*', comment: 'личное' });
      assert.equal(result.status, 'draft');
    });
    await t.test('потеря ответа сохраняет ввод и повторяет тот же envelope', async () => {
      const result = await page.evaluate(async () => {
        const session = await window.pending.openPendingInput(window.keyMaterial);
        const editor = await session.openEditor('draft-send', '0');
        await editor.edit({ text: '60*6' });
        await editor.prepare({
          commandType: 'technical-change',
          rootId: 'root-a',
          payload: { text: '60*6' },
          occurredOn: '2026-11-11',
        });
        const sent = [];
        await editor.send(async (command) => {
          sent.push(command);
          throw new Error('network');
        });
        const afterFailure = editor.snapshot();
        await editor.retry(async (command) => {
          sent.push(command);
          return {
            operationId: command.operationId,
            recoveryGeneration: command.recoveryGeneration,
            revision: '1',
            result: { text: '60*6' },
          };
        });
        const afterRetry = editor.snapshot();
        await session.close();
        return { sent, afterFailure, afterRetry };
      });
      assert.equal(result.afterFailure.status, 'unknown');
      assert.deepEqual(result.afterFailure.fields, { text: '60*6' });
      assert.deepEqual(result.sent[0], result.sent[1]);
      assert.equal(result.afterRetry.status, 'confirmed');
      assert.equal(result.afterRetry.fields, null);
    });
    await t.test('отправка после закрытия восстанавливается как неизвестная, поздний ответ оставляет новую правку', async () => {
      const result = await page.evaluate(async () => {
        const session = await window.pending.openPendingInput(window.keyMaterial);
        const editor = await session.openEditor('draft-late', '0');
        await editor.edit({ text: '60*6' });
        await editor.prepare({
          commandType: 'technical-change',
          rootId: 'root',
          payload: { text: '60*6' },
          occurredOn: '2026-11-11',
        });
        let release;
        const started = new Promise((done) => {
          window.start = done;
        });
        const sending = editor.send(async (command) => {
          window.start();
          return new Promise((done) => {
            release = () =>
              done({
                operationId: command.operationId,
                recoveryGeneration: command.recoveryGeneration,
                revision: '1',
                result: { text: '60*6' },
              });
          });
        });
        await started;
        const anotherSession = await window.pending.openPendingInput(window.keyMaterial);
        const restored = await anotherSession.openEditor('draft-late', '0');
        const restoredStatus = restored.snapshot().status;
        await anotherSession.close();
        await editor.edit({ text: '60*7' });
        release();
        await sending;
        const snapshot = editor.snapshot();
        await session.close();
        return { restoredStatus, snapshot };
      });
      assert.equal(result.restoredStatus, 'unknown');
      assert.deepEqual(result.snapshot.fields, { text: '60*7' });
      assert.equal(result.snapshot.baseRevision, '0');
      assert.equal(result.snapshot.confirmed.revision, '1');
    });
    await t.test('локальный отказ сохраняет поля в памяти и не допускает сетевую отправку', async () => {
      const result = await page.evaluate(async () => {
        const session = await window.pending.openPendingInput(window.keyMaterial);
        const editor = await session.openEditor('draft-quota', '0');
        const original = IDBDatabase.prototype.transaction;
        IDBDatabase.prototype.transaction = function (...args) {
          if (args[1] === 'readwrite') {
            throw new DOMException('quota', 'QuotaExceededError');
          }
          return original.apply(this, args);
        };
        let sent = false;
        try {
          await editor.edit({ text: 'ввод в памяти' }).catch(() => {
            // Отказ ожидается: сценарий проверяет сохранность состояния после этой ошибки.
            return undefined;
          });
          await editor
            .prepare({ commandType: 'technical-change', rootId: 'root', payload: {}, occurredOn: '2026-11-11' })
            .catch(() => {
              // Отказ ожидается: сценарий проверяет сохранность состояния после этой ошибки.
              return undefined;
            });
          await editor
            .send(async () => {
              sent = true;
            })
            .catch(() => {
              // Отказ ожидается: сценарий проверяет сохранность состояния после этой ошибки.
              return undefined;
            });
          return { sent, snapshot: editor.snapshot() };
        } finally {
          IDBDatabase.prototype.transaction = original;
          await session.close();
        }
      });
      assert.equal(result.sent, false);
      assert.deepEqual(result.snapshot.fields, { text: 'ввод в памяти' });
      assert.equal(result.snapshot.status, 'memory');
    });
    await t.test('блокировка скрывает поля и отбрасывает поздний ответ прежней сессии', async () => {
      const result = await page.evaluate(async () => {
        const session = await window.pending.openPendingInput(window.keyMaterial);
        const editor = await session.openEditor('draft-lock', '0');
        await editor.edit({ text: 'личный ввод А' });
        await editor.prepare({ commandType: 'technical-change', rootId: 'root', payload: {}, occurredOn: '2026-11-11' });
        let release;
        let started;
        const ready = new Promise((done) => {
          started = done;
        });
        const sending = editor.send(async (command) => {
          started();
          return new Promise((done) => {
            release = () =>
              done({
                operationId: command.operationId,
                recoveryGeneration: command.recoveryGeneration,
                revision: '1',
                result: true,
              });
          });
        });
        await ready;
        await session.lock();
        release();
        await sending;
        const hidden = editor.snapshot();
        const other = await window.pending.openPendingInput({
          ...window.keyMaterial,
          athleteId: 'athlete-b',
          keyId: crypto.randomUUID(),
          key: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))),
        });
        const otherEditor = await other.openEditor('draft-lock', '0');
        const otherFields = otherEditor.snapshot().fields;
        await other.close();
        await session.close();
        const returned = await window.pending.openPendingInput(window.keyMaterial);
        const restored = (await returned.openEditor('draft-lock', '0')).snapshot();
        await returned.close();
        return { hidden, otherFields, restored };
      });
      assert.equal(result.hidden.status, 'locked');
      assert.equal(result.hidden.fields, null);
      assert.equal(result.otherFields, null);
      assert.deepEqual(result.restored.fields, { text: 'личный ввод А' });
      assert.equal(result.restored.status, 'unknown');
    });
    await t.test('ciphertext не содержит полей и ключа; чужой ключ не удаляет запись', async () => {
      const result = await page.evaluate(async () => {
        const session = await window.pending.openPendingInput(window.keyMaterial);
        const editor = await session.openEditor('draft-crypto', '0');
        await editor.edit({ secret: 'unique-private-text' });
        await session.close();
        const readDisk = () =>
          new Promise((done) => {
            const request = indexedDB.open('kachok-drafts', 1);
            request.onsuccess = () => {
              const db = request.result;
              const transaction = db.transaction('drafts', 'readonly');
              const records = transaction.objectStore('drafts').getAll();
              transaction.oncomplete = () => {
                done(records.result);
                db.close();
              };
            };
          });
        const before = await readDisk();
        const wrong = await window.pending.openPendingInput({
          ...window.keyMaterial,
          key: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))),
        });
        let code;
        try {
          await wrong.openEditor('draft-crypto', '0');
        } catch (error) {
          code = error.code;
        }
        await wrong.close();
        const after = await readDisk();
        return {
          code,
          sameLength: before.length === after.length,
          serialized: JSON.stringify(before),
          shape: before.every(
            (record) => record.ciphertext instanceof ArrayBuffer && record.iv.length === 12 && !('key' in record),
          ),
        };
      });
      assert.equal(result.code, 'DRAFT_UNREADABLE');
      assert.equal(result.sameLength, true);
      assert.equal(result.shape, true);
      assert.equal(result.serialized.includes('unique-private-text'), false);
    });
    await t.test('устаревшая правка одного черновика не затирает новую редакцию', async () => {
      const result = await page.evaluate(async () => {
        const first = await window.pending.openPendingInput(window.keyMaterial);
        const second = await window.pending.openPendingInput(window.keyMaterial);
        const editorA = await first.openEditor('draft-cas', '0');
        const editorB = await second.openEditor('draft-cas', '0');
        await editorA.edit({ text: 'новая редакция' });
        let code;
        try {
          await editorB.edit({ text: 'устаревшая редакция' });
        } catch (error) {
          code = error.code;
        }
        await first.close();
        await second.close();
        const reopened = await window.pending.openPendingInput(window.keyMaterial);
        const fields = (await reopened.openEditor('draft-cas', '0')).snapshot().fields;
        await reopened.close();
        return { code, fields };
      });
      assert.equal(result.code, 'LOCAL_REVISION_CONFLICT');
      assert.deepEqual(result.fields, { text: 'новая редакция' });
    });
    await t.test('отказ поколения сохраняет старую команду до явной сверки', async () => {
      const result = await page.evaluate(async () => {
        const session = await window.pending.openPendingInput(window.keyMaterial);
        const editor = await session.openEditor('draft-generation', '0');
        await editor.edit({ text: 'старый ввод' });
        await editor.prepare({ commandType: 'technical-change', rootId: 'root', payload: {}, occurredOn: '2026-11-11' });
        const before = editor.snapshot().pending.command;
        await editor.send(async () => {
          throw { code: 'RECOVERY_GENERATION_MISMATCH' };
        });
        const after = editor.snapshot();
        await session.close();
        return { before, after };
      });
      assert.equal(result.after.status, 'conflict');
      assert.deepEqual(result.after.pending.command, result.before);
      assert.deepEqual(result.after.fields, { text: 'старый ввод' });
    });
    await t.test('перестановка ciphertext между идентификаторами черновиков не расшифровывается', async () => {
      const code = await page.evaluate(async () => {
        const session = await window.pending.openPendingInput(window.keyMaterial);
        await (await session.openEditor('draft-source', '0')).edit({ text: 'личное А' });
        await session.close();
        await new Promise((done) => {
          const request = indexedDB.open('kachok-drafts', 1);
          request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction('drafts', 'readwrite');
            const store = transaction.objectStore('drafts');
            const record = store.get(JSON.stringify(['athlete-a', 'draft-source']));
            record.onsuccess = () => store.put({ ...record.result, id: JSON.stringify(['athlete-a', 'draft-target']) });
            transaction.oncomplete = () => {
              db.close();
              done();
            };
          };
        });
        const reopened = await window.pending.openPendingInput(window.keyMaterial);
        try {
          await reopened.openEditor('draft-target', '0');
          return null;
        } catch (error) {
          return error.code;
        } finally {
          await reopened.close();
        }
      });
      assert.equal(code, 'DRAFT_UNREADABLE');
    });
    await t.test(
      'при квоте и блокировке остаётся только ciphertext, прежний владелец может продолжить в той же вкладке',
      async () => {
        const result = await page.evaluate(async () => {
          const session = await window.pending.openPendingInput(window.keyMaterial);
          const editor = await session.openEditor('draft-volatile', '0');
          const original = IDBDatabase.prototype.transaction;
          IDBDatabase.prototype.transaction = function (...args) {
            if (args[1] === 'readwrite') {
              throw new DOMException('quota', 'QuotaExceededError');
            }
            return original.apply(this, args);
          };
          await editor.edit({ text: 'не потерять при выходе' }).catch(() => {
            // Отказ ожидается: сценарий проверяет сохранность состояния после этой ошибки.
            return undefined;
          });
          await session.lock();
          const hidden = editor.snapshot();
          IDBDatabase.prototype.transaction = original;
          await session.resume(window.keyMaterial);
          const restored = await session.openEditor('draft-volatile', '0');
          const beforeRetry = restored.snapshot();
          await restored.retryLocal();
          const afterRetry = restored.snapshot();
          await session.close();
          return { hidden, beforeRetry, afterRetry };
        });
        assert.equal(result.hidden.fields, null);
        assert.deepEqual(result.beforeRetry.fields, { text: 'не потерять при выходе' });
        assert.equal(result.beforeRetry.status, 'memory');
        assert.equal(result.afterRetry.status, 'draft');
      },
    );
    await t.test('историческое подтверждение не заменяет уже известную новую редакцию сервера', async () => {
      const result = await page.evaluate(async () => {
        const session = await window.pending.openPendingInput(window.keyMaterial);
        const editor = await session.openEditor('draft-known', '0');
        await editor.edit({ text: 'ранняя правка' });
        await editor.prepare({ commandType: 'technical-change', rootId: 'root', payload: {}, occurredOn: '2026-11-11' });
        await editor.observeConfirmed({ revision: '2', result: { text: 'новее на сервере' } });
        await editor.send(async (command) => ({
          operationId: command.operationId,
          recoveryGeneration: command.recoveryGeneration,
          revision: '1',
          result: { text: 'исторический результат' },
        }));
        const snapshot = editor.snapshot();
        await session.close();
        return snapshot;
      });
      assert.equal(result.confirmed.revision, '2');
      assert.equal(result.lastReceipt.revision, '1');
    });
    await t.test('блокировка сообщает другой вкладке скрыть личный ввод', async () => {
      const result = await page.evaluate(async () => {
        const first = await window.pending.openPendingInput(window.keyMaterial);
        const second = await window.pending.openPendingInput(window.keyMaterial);
        const editor = await second.openEditor('draft-channel', '0');
        await editor.edit({ text: 'личное во второй вкладке' });
        await first.lock();
        for (let i = 0; i < 100 && editor.snapshot().status !== 'locked'; i++) {
          await new Promise((done) => setTimeout(done, 5));
        }
        const snapshot = editor.snapshot();
        await first.close();
        await second.close();
        return snapshot;
      });
      assert.equal(result.status, 'locked');
      assert.equal(result.fields, null);
    });
    await t.test('после явной сверки создаётся новая команда нового поколения без изменения старой', async () => {
      const result = await page.evaluate(async () => {
        const session = await window.pending.openPendingInput(window.keyMaterial);
        const editor = await session.openEditor('draft-reconcile', '0');
        await editor.edit({ text: 'сверить' });
        const shape = { commandType: 'technical-change', rootId: 'root', payload: {}, occurredOn: '2026-11-11' };
        await editor.prepare(shape);
        const old = editor.snapshot().pending.command;
        await editor.send(async () => {
          throw { code: 'RECOVERY_GENERATION_MISMATCH' };
        });
        await session.lock();
        await session.resume({ ...window.keyMaterial, recoveryGeneration: 'generation-new' });
        const returned = await session.openEditor('draft-reconcile', '0');
        const preserved = returned.snapshot().pending.command;
        await returned.reconcile('5');
        await returned.prepare(shape);
        const replacement = returned.snapshot().pending.command;
        await session.close();
        return { old, preserved, replacement };
      });
      assert.deepEqual(result.old, result.preserved);
      assert.equal(result.replacement.recoveryGeneration, 'generation-new');
      assert.equal(result.replacement.baseRevision, '5');
      assert.notEqual(result.replacement.operationId, result.old.operationId);
    });
    await t.test('новая правка после подтверждения остаётся черновиком, старый редактор не оживает после входа', async () => {
      const result = await page.evaluate(async () => {
        const session = await window.pending.openPendingInput(window.keyMaterial);
        const editor = await session.openEditor('draft-lifecycle', '0');
        await editor.edit({ text: 'первая' });
        await editor.prepare({ commandType: 'technical-change', rootId: 'root', payload: {}, occurredOn: '2026-11-11' });
        await editor.send(async (command) => ({
          operationId: command.operationId,
          recoveryGeneration: command.recoveryGeneration,
          revision: '1',
          result: true,
        }));
        await editor.edit({ text: 'новая' });
        const status = editor.snapshot().status;
        await session.lock();
        await session.resume(window.keyMaterial);
        let code;
        try {
          await editor.edit({ text: 'старый handle' });
        } catch (error) {
          code = error.code;
        }
        const restored = (await session.openEditor('draft-lifecycle', '0')).snapshot();
        await session.close();
        return { status, code, restored };
      });
      assert.equal(result.status, 'draft');
      assert.equal(result.code, 'ACCESS_REQUIRED');
      assert.deepEqual(result.restored.fields, { text: 'новая' });
    });
    await t.test('недоступная IndexedDB оставляет редактирование в памяти без отправки', async () => {
      const result = await page.evaluate(async () => {
        const original = IDBFactory.prototype.open;
        IDBFactory.prototype.open = () => {
          throw new DOMException('disabled', 'SecurityError');
        };
        try {
          const session = await window.pending.openPendingInput(window.keyMaterial, 'disabled-storage');
          const editor = await session.openEditor('memory-only', '0');
          await editor.edit({ text: 'не стирать' }).catch(() => {
            // Отказ ожидается: сценарий проверяет сохранность состояния после этой ошибки.
            return undefined;
          });
          const snapshot = editor.snapshot();
          await session.close();
          return snapshot;
        } finally {
          IDBFactory.prototype.open = original;
        }
      });
      assert.equal(result.status, 'memory');
      assert.deepEqual(result.fields, { text: 'не стирать' });
    });
    await t.test('обычное закрытие вкладки сохраняет завершённый черновик для прежнего ключа', async () => {
      const material = await page.evaluate(() => window.keyMaterial);
      const inputPage = await page.context().newPage();
      await inputPage.goto(origin);
      await inputPage.evaluate(async (material) => {
        const { openPendingInput } = await import('/src/diary/pending-input.ts');
        const session = await openPendingInput(material);
        await (await session.openEditor('draft-tab-close', '0')).edit({ text: 'после закрытия вкладки' });
      }, material);
      await inputPage.close();
      const returnPage = await page.context().newPage();
      try {
        await returnPage.goto(origin);
        const fields = await returnPage.evaluate(async (material) => {
          const { openPendingInput } = await import('/src/diary/pending-input.ts');
          const session = await openPendingInput(material);
          const snapshot = (await session.openEditor('draft-tab-close', '0')).snapshot();
          await session.close();
          return snapshot.fields;
        }, material);
        assert.deepEqual(fields, { text: 'после закрытия вкладки' });
      } finally {
        await returnPage.close();
      }
    });
    await t.test('ответ другой команды сохраняет неизвестный исход и допускает повтор прежней', async () => {
      const result = await page.evaluate(async () => {
        const session = await window.pending.openPendingInput(window.keyMaterial);
        const editor = await session.openEditor('draft-bad-response', '0');
        await editor.edit({ text: 'сохранить' });
        await editor.prepare({ commandType: 'technical-change', rootId: 'root', payload: {}, occurredOn: '2026-11-11' });
        await editor
          .send(async () => ({
            operationId: crypto.randomUUID(),
            recoveryGeneration: 'generation-a',
            revision: '1',
            result: true,
          }))
          .catch(() => {
            // Отказ ожидается: сценарий проверяет сохранность состояния после этой ошибки.
            return undefined;
          });
        const snapshot = editor.snapshot();
        await editor.retry(async (command) => ({
          operationId: command.operationId,
          recoveryGeneration: command.recoveryGeneration,
          revision: '1',
          result: true,
        }));
        const afterRetry = editor.snapshot();
        await session.close();
        return { snapshot, afterRetry };
      });
      assert.equal(result.snapshot.status, 'unknown');
      assert.deepEqual(result.snapshot.fields, { text: 'сохранить' });
      assert.equal(result.afterRetry.status, 'confirmed');
    });
    await t.test('локальное сохранение не объявляется завершённым до complete, новый вход ждёт блокировку', async () => {
      const result = await page.evaluate(async () => {
        const session = await window.pending.openPendingInput(window.keyMaterial);
        const editor = await session.openEditor('draft-lock-race', '0');
        const original = crypto.subtle.encrypt;
        let release;
        let started;
        const ready = new Promise((done) => {
          started = done;
        });
        const gate = new Promise((done) => {
          release = done;
        });
        crypto.subtle.encrypt = async function (...args) {
          started();
          await gate;
          return original.apply(this, args);
        };
        const saving = editor.edit({ text: 'запись перед выходом' });
        await ready;
        const duringSave = editor.snapshot().status;
        const locking = session.lock(false);
        const resuming = session.resume(window.keyMaterial);
        release();
        try {
          await saving;
          await locking;
          await resuming;
          const current = await session.openEditor('draft-lock-race', '0');
          const restored = current.snapshot();
          await current.edit({ text: 'после входа' });
          return { duringSave, restored, afterEdit: current.snapshot() };
        } finally {
          crypto.subtle.encrypt = original;
          await session.close();
        }
      });
      assert.equal(result.duringSave, 'saving');
      assert.deepEqual(result.restored.fields, { text: 'запись перед выходом' });
      assert.deepEqual(result.afterEdit.fields, { text: 'после входа' });
    });
    await page.close();
  } finally {
    await browser?.close();
    await server.stop();
  }
});
