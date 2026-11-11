export class DraftError extends Error {
  constructor(readonly code: 'LOCAL_STORAGE_FAILED' | 'LOCAL_REVISION_CONFLICT' | 'DRAFT_UNREADABLE' | 'ACCESS_REQUIRED' | 'PENDING_OPERATION' | 'CONFIRMATION_MISMATCH') { super(code); }
}

export interface DraftKeyMaterial {
  athleteId: string;
  keyId: string;
  key: string;
  recoveryGeneration: string;
}

interface CipherRecord {
  id: string;
  format: 1;
  athleteId: string;
  keyId: string;
  draftId: string;
  revision: number;
  iv: Uint8Array<ArrayBuffer>;
  ciphertext: ArrayBuffer;
}

export async function openEncryptedDrafts(material: DraftKeyMaterial, databaseName = 'kachok-drafts', suspended: CipherRecord[] = []) {
  const { athleteId, keyId } = material;
  let key: CryptoKey | undefined = await crypto.subtle.importKey('raw', Uint8Array.from(atob(material.key), (char) => char.charCodeAt(0)), 'AES-GCM', false, ['encrypt', 'decrypt']);
  const volatile = new Map(suspended.map((record) => [record.draftId, record]));
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('drafts', { keyPath: 'id' }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new DraftError('LOCAL_STORAGE_FAILED'));
    request.onblocked = () => reject(new DraftError('LOCAL_STORAGE_FAILED'));
  }).catch(() => undefined);
  if (db) db.onversionchange = () => db.close();
  const id = (draftId: string) => JSON.stringify([athleteId, draftId]);
  const aad = (record: Omit<CipherRecord, 'ciphertext' | 'iv' | 'id'>) => new TextEncoder().encode(JSON.stringify([record.format, record.athleteId, record.keyId, record.draftId, record.revision]));
  return {
    async load<Value>(draftId: string): Promise<{ revision: number; durable: boolean; value: Value } | null> {
      if (!key) throw new DraftError('ACCESS_REQUIRED');
      const record = volatile.get(draftId) ?? (db ? await new Promise<CipherRecord | undefined>((resolve, reject) => {
        const transaction = db.transaction('drafts', 'readonly');
        const request = transaction.objectStore('drafts').get(id(draftId));
        transaction.oncomplete = () => resolve(request.result);
        transaction.onabort = () => reject(new DraftError('LOCAL_STORAGE_FAILED'));
      }) : undefined);
      if (!record) return null;
      if (record.format !== 1 || record.keyId !== keyId || record.athleteId !== athleteId || record.draftId !== draftId || record.id !== id(draftId)) throw new DraftError('DRAFT_UNREADABLE');
      try {
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: record.iv, additionalData: aad(record) }, key, record.ciphertext);
        const durable = !volatile.has(draftId);
        return { revision: durable ? record.revision : record.revision - 1, durable, value: JSON.parse(new TextDecoder().decode(plain)) as Value };
      } catch { throw new DraftError('DRAFT_UNREADABLE'); }
    },
    async save<Value>(draftId: string, expectedRevision: number, value: Value) {
      if (!key) throw new DraftError('ACCESS_REQUIRED');
      const metadata = { format: 1 as const, athleteId, keyId, draftId, revision: expectedRevision + 1 };
      const iv = crypto.getRandomValues(new Uint8Array(12));
      let ciphertext: ArrayBuffer;
      try { ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(metadata) }, key, new TextEncoder().encode(JSON.stringify(value))); }
      catch { throw new DraftError('LOCAL_STORAGE_FAILED'); }
      const record: CipherRecord = { ...metadata, id: id(draftId), iv, ciphertext };
      volatile.set(draftId, record);
      if (!db) throw new DraftError('LOCAL_STORAGE_FAILED');
      await new Promise<void>((resolve, reject) => {
        let conflict = false;
        const transaction = db.transaction('drafts', 'readwrite');
        const store = transaction.objectStore('drafts');
        const request = store.get(record.id);
        request.onsuccess = () => {
          if ((request.result?.revision ?? 0) !== expectedRevision) { conflict = true; transaction.abort(); }
          else store.put(record);
        };
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(new DraftError(conflict ? 'LOCAL_REVISION_CONFLICT' : 'LOCAL_STORAGE_FAILED'));
      });
      if (volatile.get(draftId) === record) volatile.delete(draftId);
      return metadata.revision;
    },
    close() { key = undefined; db?.close(); return [...volatile.values()]; },
  };
}
