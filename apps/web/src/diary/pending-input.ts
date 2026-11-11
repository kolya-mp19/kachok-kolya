import { openEncryptedDrafts } from './encrypted-drafts';
import { PendingInputSession } from './drafts/pending-input-session';
import type { DraftKeyMaterial } from './drafts/drafts.type';

async function requestPersistentStorage(): Promise<boolean> {
    try {
        return (await navigator.storage?.persist?.()) ?? false;
    } catch {
        // Отказ запроса устойчивого хранения не означает отказ самой IndexedDB.
        // Сессия сообщает отсутствие гарантии, но позволяет сохранить доступный черновик.
        return false;
    }
}

/** Ключ и владелец передаются после сетевой проверки доступа; автономный вход не создаётся. */
export async function openPendingInput(
    material: DraftKeyMaterial,
    databaseName?: string,
): Promise<PendingInputSession> {
    const persistentStorage = await requestPersistentStorage();
    const storage = await openEncryptedDrafts(material, databaseName);

    return new PendingInputSession(
        material.athleteId,
        material.keyId,
        material.recoveryGeneration,
        storage,
        persistentStorage,
        databaseName,
    );
}
