import type { Prisma } from '@prisma/client';
import type { VerifiedAccess } from '../access/access.type.js';
import type { Json, OperationEnvelope } from './protocol.js';

export const RECOVERY_GENERATION = Symbol('RECOVERY_GENERATION');

export type AppliedOperation = {
  revision: string;
  result: Json;
};

/**
 * Оба метода работают только через переданный tx и не выполняют внешние вызовы:
 * при конфликте сериализации вся транзакция, включая apply, запускается заново.
 */
export interface OperationHandler {
  currentRevision(tx: Prisma.TransactionClient, owner: VerifiedAccess, command: OperationEnvelope): Promise<string>;
  apply(tx: Prisma.TransactionClient, owner: VerifiedAccess, command: OperationEnvelope): Promise<AppliedOperation>;
}

export type DraftKeyResponse = {
  keyId: string;
  key: string;
};
