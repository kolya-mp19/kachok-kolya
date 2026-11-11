import { DraftError, openEncryptedDrafts, type DraftKeyMaterial } from './encrypted-drafts';
import type { Json, OperationEnvelope, OperationConfirmation } from '../../../api/src/operations/protocol.js';

interface EditorState {
  fields: Json;
  baseRevision: string;
  localRevision: number;
  status: 'saving' | 'draft' | 'ready' | 'sending' | 'unknown' | 'confirmed' | 'conflict' | 'memory' | 'locked';
  pending?: { command: OperationEnvelope; localRevision: number };
  confirmed?: Pick<OperationConfirmation, 'revision' | 'result'>;
  lastReceipt?: OperationConfirmation;
}

export async function openPendingInput(material: DraftKeyMaterial, databaseName?: string) {
  const persistentStorage = await navigator.storage?.persist?.().catch(() => false) ?? false;
  let drafts = await openEncryptedDrafts(material, databaseName);
  const { athleteId, keyId } = material;
  let recoveryGeneration = material.recoveryGeneration;
  let suspended: Parameters<typeof openEncryptedDrafts>[2] = [];
  let locked = false;
  let closed = false;
  let locking: Promise<void> | undefined;
  let resuming = false;
  let epoch = 0;
  const editors: Array<{ flush: () => Promise<void>; forget: () => void }> = [];
  const active = () => { if (locked || closed) throw new DraftError('ACCESS_REQUIRED'); };
  const session = {
    persistentStorage,
    async openEditor(draftId: string, baseRevision: string) {
      active();
      const stored = await drafts.load<EditorState>(draftId);
      active();
      const editorEpoch = epoch;
      const editorActive = () => { active(); if (editorEpoch !== epoch) throw new DraftError('ACCESS_REQUIRED'); };
      let state = stored?.value ?? { fields: null, baseRevision, localRevision: 0, status: 'draft' as const };
      if (state.status === 'sending') state.status = 'unknown';
      if (stored && !stored.durable) state.status = 'memory';
      let revision = stored?.revision ?? 0;
      let tail = Promise.resolve();
      let desiredStatus: EditorState['status'] = state.status;
      let saveVersion = 0;
      let requestInFlight = false;
      const persist = () => {
        const targetStatus = state.status === 'saving' ? desiredStatus : state.status;
        desiredStatus = targetStatus;
        const snapshot = { ...structuredClone(state), status: targetStatus };
        const version = ++saveVersion;
        state.status = 'saving';
        const task = tail.then(async () => {
          try {
            revision = await drafts.save(draftId, revision, snapshot);
            if (version === saveVersion) state.status = targetStatus;
          }
          catch (error) { state.status = 'memory'; throw error instanceof DraftError ? error : new DraftError('LOCAL_STORAGE_FAILED'); }
        });
        tail = task.catch(() => {});
        return task;
      };
      const editor = {
        snapshot: () => locked || editorEpoch !== epoch ? { fields: null, baseRevision: '', localRevision: 0, status: 'locked' as const } : structuredClone(state),
        async edit(fields: Json) {
          editorActive();
          state = { ...state, fields: structuredClone(fields), localRevision: state.localRevision + 1 };
          if (!state.pending) state.status = 'draft';
          await persist();
        },
        async prepare(command: Pick<OperationEnvelope, 'commandType' | 'rootId' | 'payload' | 'occurredOn'>) {
          editorActive();
          if (state.pending) throw new DraftError('PENDING_OPERATION');
          state.pending = { command: { ...structuredClone(command), protocolVersion: 1, athleteId, recoveryGeneration, operationId: crypto.randomUUID(), baseRevision: state.baseRevision }, localRevision: state.localRevision };
          state.status = 'ready';
          await persist();
        },
        async send(transport: (command: OperationEnvelope) => Promise<OperationConfirmation>) {
          editorActive();
          const requestEpoch = epoch;
          if (!state.pending || requestInFlight) throw new DraftError('PENDING_OPERATION');
          requestInFlight = true;
          try {
            const pending = structuredClone(state.pending);
            state.status = 'sending';
            await persist();
            if (locked || epoch !== requestEpoch) return;
            let confirmation: OperationConfirmation;
            try { confirmation = await transport(structuredClone(pending.command)); }
            catch (error) {
              if (locked || epoch !== requestEpoch) return;
              const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
              if (code === 'ACCESS_REQUIRED') { await session.lock(); return; }
              state.status = ['RECOVERY_GENERATION_MISMATCH', 'REVISION_CONFLICT', 'OPERATION_ID_CONFLICT', 'INVALID_OPERATION', 'OPERATION_REJECTED', 'OWNER_MISMATCH'].includes(String(code)) ? 'conflict' : 'unknown';
              await persist();
              return;
            }
            if (locked || epoch !== requestEpoch) return;
            if (!confirmation || confirmation.operationId !== pending.command.operationId || confirmation.recoveryGeneration !== pending.command.recoveryGeneration) {
              state.status = 'unknown'; await persist(); throw new DraftError('CONFIRMATION_MISMATCH');
            }
            state.lastReceipt = structuredClone(confirmation);
            if (!state.confirmed || state.confirmed.revision === pending.command.baseRevision || state.confirmed.revision === confirmation.revision) state.confirmed = structuredClone(confirmation);
            state.pending = undefined;
            if (state.localRevision === pending.localRevision) state.fields = null;
            state.status = state.fields === null ? 'confirmed' : 'draft';
            await persist();
          } finally { requestInFlight = false; }
        },
        async retry(transport: (command: OperationEnvelope) => Promise<OperationConfirmation>) { await editor.send(transport); },
        async retryLocal() { editorActive(); state.status = state.pending ? 'unknown' : 'draft'; await persist(); },
        async reconcile(baseRevision: string) {
          editorActive();
          if (state.pending && state.status !== 'conflict') throw new DraftError('PENDING_OPERATION');
          state.pending = undefined;
          state.baseRevision = baseRevision;
          state.status = 'draft';
          await persist();
        },
        async observeConfirmed(confirmed: Pick<OperationConfirmation, 'revision' | 'result'>) {
          editorActive(); state.confirmed = structuredClone(confirmed); await persist();
        },
      };
      editors.push({ flush: () => tail, forget: () => { state = { fields: null, baseRevision: '', localRevision: 0, status: 'locked' }; } });
      return editor;
    },
    lock(broadcast = true): Promise<void> {
      if (locked) { epoch++; return locking ?? Promise.resolve(); }
      locked = true; epoch++;
      const closingDrafts = drafts;
      const closingEditors = [...editors];
      locking = (async () => {
        if (broadcast) channel.postMessage({ kind: 'lock' });
        await Promise.all(closingEditors.map((editor) => editor.flush()));
        closingEditors.forEach((editor) => editor.forget());
        suspended = closingDrafts.close();
      })();
      return locking;
    },
    async resume(material: DraftKeyMaterial) {
      if (!locked || closed || resuming || material.athleteId !== athleteId || material.keyId !== keyId) throw new DraftError('ACCESS_REQUIRED');
      resuming = true;
      const resumeEpoch = epoch;
      try {
        await locking;
        const opened = await openEncryptedDrafts(material, databaseName, suspended);
        if (closed || epoch !== resumeEpoch) { opened.close(); throw new DraftError('ACCESS_REQUIRED'); }
        drafts = opened;
        recoveryGeneration = material.recoveryGeneration;
        suspended = [];
        editors.length = 0;
        epoch++; locked = false;
      } finally { resuming = false; }
    },
    async close() { closed = true; await session.lock(false); channel.close(); },
  };
  const channel = new BroadcastChannel((databaseName ?? 'kachok-drafts') + ':access');
  channel.onmessage = (event) => { if (event.data?.kind === 'lock') void session.lock(false); };
  return session;
}
