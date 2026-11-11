import { DraftError } from './draft.error';
import { IndexedDraftRepository } from './indexed-draft.repository';
import type { CipherMetadata, CipherRecord, StoredDraft } from './drafts.type';

function authenticatedData(metadata: CipherMetadata): Uint8Array<ArrayBuffer> {
    return new TextEncoder().encode(
        JSON.stringify([metadata.format, metadata.athleteId, metadata.keyId, metadata.draftId, metadata.revision]),
    );
}

export class EncryptedDraftStorage {
    private readonly volatile: Map<string, CipherRecord>;

    constructor(
        private key: CryptoKey | undefined,
        private readonly athleteId: string,
        private readonly keyId: string,
        private readonly repository: IndexedDraftRepository,
        suspended: CipherRecord[] = [],
    ) {
        this.volatile = new Map(suspended.map((record) => [record.draftId, record]));
    }

    async load(draftId: string): Promise<StoredDraft | null> {
        const key = this.requireKey();
        const record = this.volatile.get(draftId) ?? (await this.repository.findById(this.recordId(draftId)));

        if (!record) {
            return null;
        }

        this.assertMetadata(record, draftId);

        try {
            const plaintext = await crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: record.iv,
                    additionalData: authenticatedData(record),
                },
                key,
                record.ciphertext,
            );
            const value: unknown = JSON.parse(new TextDecoder().decode(plaintext));
            const durable = !this.volatile.has(draftId);

            return {
                // Volatile-запись не получила commit. Повтор использует последнюю
                // подтверждённую локальную редакцию, а не номер неудавшейся записи.
                revision: durable ? record.revision : record.revision - 1,
                durable,
                value,
            };
        } catch {
            // Нечитаемость не даёт права удалять ciphertext: прежний ключ ещё может вернуться.
            throw new DraftError('DRAFT_UNREADABLE');
        }
    }

    async save(draftId: string, expectedRevision: number, value: unknown): Promise<number> {
        const key = this.requireKey();
        const metadata: CipherMetadata = {
            format: 1,
            athleteId: this.athleteId,
            keyId: this.keyId,
            draftId,
            revision: expectedRevision + 1,
        };
        const iv = crypto.getRandomValues(new Uint8Array(12));
        let ciphertext: ArrayBuffer;

        try {
            ciphertext = await crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv,
                    additionalData: authenticatedData(metadata),
                },
                key,
                new TextEncoder().encode(JSON.stringify(value)),
            );
        } catch {
            throw new DraftError('LOCAL_STORAGE_FAILED');
        }

        const record: CipherRecord = { ...metadata, id: this.recordId(draftId), iv, ciphertext };

        // При квоте сохраняем только зашифрованный остаток. После блокировки
        // plaintext и ключ удалятся, но та же вкладка сможет продолжить прежним ключом.
        this.volatile.set(draftId, record);
        await this.repository.save(record, expectedRevision);

        if (this.volatile.get(draftId) === record) {
            this.volatile.delete(draftId);
        }

        return metadata.revision;
    }

    /** Возвращает только ciphertext, чтобы сессия могла очистить ключ и открытые поля. */
    close(): CipherRecord[] {
        this.key = undefined;
        this.repository.close();

        return [...this.volatile.values()];
    }

    private requireKey(): CryptoKey {
        if (!this.key) {
            throw new DraftError('ACCESS_REQUIRED');
        }

        return this.key;
    }

    private recordId(draftId: string): string {
        return JSON.stringify([this.athleteId, draftId]);
    }

    private assertMetadata(record: CipherRecord, draftId: string): void {
        const matchesOwner = record.athleteId === this.athleteId && record.keyId === this.keyId;
        const matchesDraft = record.draftId === draftId && record.id === this.recordId(draftId);

        if (record.format !== 1 || !matchesOwner || !matchesDraft) {
            throw new DraftError('DRAFT_UNREADABLE');
        }
    }
}
