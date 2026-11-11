export type StorageErrorCode = 'STORAGE_CONFIG_INVALID' | 'STORAGE_UNAVAILABLE' | 'MIGRATION_FAILED';
export type StorageStage = 'configuration' | 'connection' | 'migration';

export class StorageError extends Error {
  constructor(
    readonly code: StorageErrorCode,
    readonly stage: StorageStage,
  ) {
    super(code);
  }
}
