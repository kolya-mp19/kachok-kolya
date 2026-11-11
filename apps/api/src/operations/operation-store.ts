import type { PrismaClient } from '@prisma/client';
import type { OwnedOperationsService } from '../access/owned-operations.service.js';
import { DraftKeysRepository } from './draft-keys.repository.js';
import { OperationReceiptsRepository } from './operation-receipts.repository.js';
import { OperationsService } from './operations.service.js';

export { OperationError } from './operation.error.js';
export type { OperationHandler } from './operations.type.js';

/**
 * Сохраняет точку автономного подключения E005 без скрытого изменяемого состояния.
 * В приложении тот же граф зависимостей собирает OperationsModule.register.
 * Клиент БД остаётся собственностью вызывающего кода: он обязан закрыть его сам.
 */
export function createOperationStore<Credential>(
  storage: PrismaClient,
  access: OwnedOperationsService<Credential>,
  recoveryGeneration: string,
): OperationsService<Credential> {
  return new OperationsService(
    storage,
    access,
    recoveryGeneration,
    new OperationReceiptsRepository(storage),
    new DraftKeysRepository(storage),
  );
}
