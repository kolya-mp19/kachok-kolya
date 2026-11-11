import { DraftError } from './draft.error';
import { parseCipherRecord } from './draft-parser';
import type { CipherRecord } from './drafts.type';

export class IndexedDraftRepository {
    constructor(private readonly database: IDBDatabase | undefined) {}

    static async open(databaseName: string): Promise<IndexedDraftRepository> {
        try {
            const database = await new Promise<IDBDatabase>((resolve, reject) => {
                const request = indexedDB.open(databaseName, 1);
                let isBlocked = false;

                request.onupgradeneeded = () => {
                    request.result.createObjectStore('drafts', { keyPath: 'id' });
                };
                request.onsuccess = () => {
                    // После blocked браузер ещё может открыть соединение. Оно больше
                    // никому не принадлежит и не должно мешать последующим открытиям.
                    if (isBlocked) {
                        request.result.close();
                        return;
                    }

                    resolve(request.result);
                };
                request.onerror = () => reject(new DraftError('LOCAL_STORAGE_FAILED'));
                request.onblocked = () => {
                    isBlocked = true;
                    reject(new DraftError('LOCAL_STORAGE_FAILED'));
                };
            });

            database.onversionchange = () => database.close();

            return new IndexedDraftRepository(database);
        } catch {
            // Отсутствие IndexedDB не лишает ввода в памяти. Запись явно сообщит
            // об отказе и не позволит объявить такой черновик сохранённым.
            return new IndexedDraftRepository(undefined);
        }
    }

    async findById(id: string): Promise<CipherRecord | undefined> {
        const database = this.database;
        if (!database) {
            return undefined;
        }

        const value: unknown = await new Promise((resolve, reject) => {
            const transaction = database.transaction('drafts', 'readonly');
            const request = transaction.objectStore('drafts').get(id);

            transaction.oncomplete = () => resolve(request.result);
            transaction.onabort = () => reject(new DraftError('LOCAL_STORAGE_FAILED'));
        });

        return value === undefined ? undefined : parseCipherRecord(value);
    }

    /** CAS и запись выполняются в одной транзакции: соседняя вкладка не теряет свою правку. */
    async save(record: CipherRecord, expectedRevision: number): Promise<void> {
        const database = this.database;
        if (!database) {
            throw new DraftError('LOCAL_STORAGE_FAILED');
        }

        await new Promise<void>((resolve, reject) => {
            let hasConflict = false;
            let readError: unknown;
            const transaction = database.transaction('drafts', 'readwrite');
            const store = transaction.objectStore('drafts');
            const request = store.get(record.id);

            request.onsuccess = () => {
                try {
                    const current: unknown = request.result;
                    const revision = current === undefined ? 0 : parseCipherRecord(current).revision;

                    if (revision !== expectedRevision) {
                        hasConflict = true;
                        transaction.abort();
                        return;
                    }

                    store.put(record);
                } catch (error: unknown) {
                    readError = error;
                    transaction.abort();
                }
            };
            // Успех запроса put ещё не означает commit: гарантия появляется на complete.
            transaction.oncomplete = () => resolve();
            transaction.onabort = () => {
                if (readError instanceof DraftError) {
                    reject(readError);
                    return;
                }

                const code = hasConflict ? 'LOCAL_REVISION_CONFLICT' : 'LOCAL_STORAGE_FAILED';
                reject(new DraftError(code));
            };
        });
    }

    close(): void {
        this.database?.close();
    }
}
