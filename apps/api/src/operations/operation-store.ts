import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { createOwnedOperations, OwnedOperationError } from '../access/owned-operation.js';
import type { VerifiedAccess } from '../access/owned-operation.js';
import type { Json, OperationConfirmation, OperationEnvelope } from './protocol.js';

export interface OperationHandler {
  currentRevision(tx: Prisma.TransactionClient, owner: VerifiedAccess, command: OperationEnvelope): Promise<string>;
  apply(tx: Prisma.TransactionClient, owner: VerifiedAccess, command: OperationEnvelope): Promise<{ revision: string; result: Json }>;
}

export class OperationError extends Error {
  constructor(readonly code: 'DRAFT_KEY_MISSING' | 'REVISION_CONFLICT' | 'OPERATION_ID_CONFLICT' | 'RECOVERY_GENERATION_MISMATCH' | 'INVALID_OPERATION' | 'OPERATION_FAILED' | 'OPERATION_REJECTED') { super(code); }
}

function isJson(value: unknown, seen = new Set<object>()): value is Json {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || seen.has(value)) return false;
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) return false;
  if (Array.isArray(value) && Object.keys(value).length !== value.length) return false;
  seen.add(value);
  const valid = Object.values(value).every((item) => isJson(item, seen));
  seen.delete(value);
  return valid;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function readEnvelope(input: unknown): OperationEnvelope {
  if (!input || typeof input !== 'object') throw new OperationError('INVALID_OPERATION');
  const value = input as Record<string, unknown>;
  const fields = ['protocolVersion', 'recoveryGeneration', 'operationId', 'athleteId', 'commandType', 'rootId', 'baseRevision', 'occurredOn', 'payload'];
  if (value.protocolVersion !== 1 || typeof value.operationId !== 'string' || !uuid.test(value.operationId)
    || (value.recoveryGeneration !== undefined && typeof value.recoveryGeneration !== 'string')
    || Object.keys(value).some((field) => !fields.includes(field))
    || !['athleteId', 'commandType', 'rootId', 'baseRevision', 'occurredOn'].every((field) => typeof value[field] === 'string' && value[field].length > 0)
    || !isJson(value.payload)) throw new OperationError('INVALID_OPERATION');
  const clone = structuredClone(value);
  const freeze = (item: unknown): void => {
    if (item && typeof item === 'object') { Object.values(item).forEach(freeze); Object.freeze(item); }
  };
  freeze(clone);
  return clone as unknown as OperationEnvelope;
}

function canonical(value: Json): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
}

async function safe<Result>(operation: () => Promise<Result>): Promise<Result> {
  try { return await operation(); }
  catch (error) {
    if (error instanceof OperationError || error instanceof OwnedOperationError) throw error;
    throw new OperationError('OPERATION_FAILED');
  }
}

export function createOperationStore<Credential>(
  storage: PrismaClient,
  access: ReturnType<typeof createOwnedOperations<Credential>>,
  recoveryGeneration: string,
) {
  if (!recoveryGeneration.trim()) throw new Error('RECOVERY_GENERATION_REQUIRED');
  const checkGeneration = (generation: string) => {
    if (generation !== recoveryGeneration) throw new OperationError('RECOVERY_GENERATION_MISMATCH');
  };
  const confirmation = (record: { operationId: string; recoveryGeneration: string; revision: string; result: unknown }): OperationConfirmation => ({
    operationId: record.operationId, recoveryGeneration: record.recoveryGeneration, revision: record.revision, result: record.result as Json,
  });
  return {
    async execute(credential: Credential, input: unknown, handler: OperationHandler) {
      const command = readEnvelope(input);
      const commandHash = createHash('sha256').update(canonical(command as unknown as Json)).digest('hex');
      return safe(() => access.run(credential, command.athleteId, async (owner) => {
        checkGeneration(command.recoveryGeneration);
        for (let attempt = 0; attempt < 3; attempt++) {
          try { return await storage.$transaction(async (tx) => {
                await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${owner.athleteId}, 0))::text`;
                return access.run(credential, owner.athleteId, async (verifiedOwner) => {
                  checkGeneration(command.recoveryGeneration);
                  const existing = await tx.operationReceipt.findUnique({ where: { athleteId_operationId: { athleteId: verifiedOwner.athleteId, operationId: command.operationId } } });
                  if (existing) {
                    if (existing.commandHash !== commandHash) throw new OperationError('OPERATION_ID_CONFLICT');
                    return confirmation(existing);
                  }
                  if (await handler.currentRevision(tx, verifiedOwner, command) !== command.baseRevision) throw new OperationError('REVISION_CONFLICT');
                  const applied = await handler.apply(tx, verifiedOwner, command);
                  const record = await tx.operationReceipt.create({ data: {
                    athleteId: verifiedOwner.athleteId, operationId: command.operationId, recoveryGeneration,
                    commandHash,
                    revision: applied.revision, result: applied.result === null ? Prisma.JsonNull : applied.result,
                  } });
                  return confirmation(record);
                });
          }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
          } catch (error) {
            const retryable = error instanceof Prisma.PrismaClientKnownRequestError
              && (error.code === 'P2034' || error.code === 'P2002'
                || (error.code === 'P2010' && ['40001', '40P01'].includes(String(error.meta?.code ?? (error.meta?.driverAdapterError as { cause?: { originalCode?: string } } | undefined)?.cause?.originalCode))));
            if (!retryable || attempt === 2) {
              if (error instanceof OperationError || error instanceof OwnedOperationError) throw error;
              throw new OperationError('OPERATION_FAILED');
            }
          }
        }
        throw new OperationError('OPERATION_FAILED');
      }));
    },
    async findReceipt(credential: Credential, expectedAthleteId: string, operationId: string, generation: string) {
      if (!uuid.test(operationId)) throw new OperationError('INVALID_OPERATION');
      return safe(() => access.run(credential, expectedAthleteId, async (owner) => {
        checkGeneration(generation);
        const record = await storage.operationReceipt.findUnique({ where: { athleteId_operationId: { athleteId: owner.athleteId, operationId } } });
        return record ? confirmation(record) : null;
      }));
    },
    getDraftKey(credential: Credential, expectedAthleteId: string, expectedKeyId?: string) {
      return safe(() => access.run(credential, expectedAthleteId, async (owner) => {
        let record = await storage.draftKey.findUnique({ where: { athleteId: owner.athleteId } });
        if (expectedKeyId && record?.keyId !== expectedKeyId) throw new OperationError('DRAFT_KEY_MISSING');
        if (!record) {
          record = await storage.draftKey.upsert({
            where: { athleteId: owner.athleteId }, update: {},
            create: { athleteId: owner.athleteId, keyId: randomUUID(), key: randomBytes(32) },
          });
        }
        return { keyId: record.keyId, key: Buffer.from(record.key).toString('base64') };
      }));
    },
  };
}
