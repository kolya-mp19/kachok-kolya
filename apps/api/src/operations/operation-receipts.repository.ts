import { Inject, Injectable } from '@nestjs/common';
import { Prisma, PrismaClient, type OperationReceipt } from '@prisma/client';
import { STORAGE_CLIENT } from '../storage/storage.tokens.js';
import type { AppliedOperation } from './operations.type.js';
import type { OperationEnvelope } from './protocol.js';

type SaveReceiptParams = {
  athleteId: string;
  command: OperationEnvelope;
  commandHash: string;
  applied: AppliedOperation;
};

@Injectable()
export class OperationReceiptsRepository {
  constructor(@Inject(STORAGE_CLIENT) private readonly storage: PrismaClient) {}

  /** Все записи одного владельца берут эту блокировку до чтения и изменения корня. */
  async lockAthlete(tx: Prisma.TransactionClient, athleteId: string): Promise<void> {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${athleteId}, 0))::text`;
  }

  async findById(athleteId: string, operationId: string, tx?: Prisma.TransactionClient): Promise<OperationReceipt | null> {
    const client = tx ?? this.storage;

    return client.operationReceipt.findUnique({
      where: { athleteId_operationId: { athleteId, operationId } },
    });
  }

  /** tx обязателен: отдельно сохранённая квитанция не доказывает фиксацию изменения. */
  async create(params: SaveReceiptParams, tx: Prisma.TransactionClient): Promise<OperationReceipt> {
    return tx.operationReceipt.create({
      data: {
        athleteId: params.athleteId,
        operationId: params.command.operationId,
        recoveryGeneration: params.command.recoveryGeneration,
        commandHash: params.commandHash,
        revision: params.applied.revision,
        result: params.applied.result === null ? Prisma.JsonNull : params.applied.result,
      },
    });
  }
}
