import { Prisma } from '@prisma/client';
import { isRecord } from './operation-parser.js';

function postgresErrorCode(meta: unknown): string | undefined {
  if (!isRecord(meta)) {
    return undefined;
  }

  if (typeof meta.code === 'string') {
    return meta.code;
  }

  const adapterError = meta.driverAdapterError;
  if (!isRecord(adapterError) || !isRecord(adapterError.cause)) {
    return undefined;
  }

  const code = adapterError.cause.originalCode;

  return typeof code === 'string' ? code : undefined;
}

/**
 * Конкурентная уникальная вставка и откат сериализации требуют повтора всей транзакции.
 * Предметные конфликты не являются временным отказом и сюда не попадают.
 */
export function isRetryableOperationError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code === 'P2034' || error.code === 'P2002') {
    return true;
  }

  return error.code === 'P2010' && ['40001', '40P01'].includes(postgresErrorCode(error.meta) ?? '');
}
