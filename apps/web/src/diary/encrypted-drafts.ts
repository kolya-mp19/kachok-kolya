import { EncryptedDraftStorage } from './drafts/encrypted-draft-storage';
import { IndexedDraftRepository } from './drafts/indexed-draft.repository';
import type { CipherRecord, DraftKeyMaterial } from './drafts/drafts.type';

export { DraftError } from './drafts/draft.error';
export type { DraftKeyMaterial } from './drafts/drafts.type';

/** Импортирует ключ как неэкспортируемый; исходная строка не сохраняется в объекте хранилища. */
export async function openEncryptedDrafts(
    material: DraftKeyMaterial,
    databaseName = 'kachok-drafts',
    suspended: CipherRecord[] = [],
): Promise<EncryptedDraftStorage> {
    const rawKey = Uint8Array.from(atob(material.key), (character) => character.charCodeAt(0));
    const key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt', 'decrypt']);
    const repository = await IndexedDraftRepository.open(databaseName);

    return new EncryptedDraftStorage(key, material.athleteId, material.keyId, repository, suspended);
}
