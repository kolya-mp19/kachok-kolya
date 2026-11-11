import type { AccessVerifier } from './access.type.js';
import { OwnedOperationsService } from './owned-operations.service.js';

// Эти экспорты сохраняют существующую точку подключения технической основы E005.
export type { VerifiedAccess } from './access.type.js';
export { OwnedOperationError } from './owned-operation.error.js';

/** Для автономного подключения без контейнера; NestJS использует AccessModule.register. */
export function createOwnedOperations<Credential>(verifyAccess: AccessVerifier<Credential>): OwnedOperationsService<Credential> {
  return new OwnedOperationsService(verifyAccess);
}
