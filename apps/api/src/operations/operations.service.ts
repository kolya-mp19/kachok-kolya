import { Inject, Injectable } from '@nestjs/common';
import { Prisma, PrismaClient, type OperationReceipt } from '@prisma/client';
import type { VerifiedAccess } from '../access/access.type.js';
import { OwnedOperationError } from '../access/owned-operation.error.js';
import { OwnedOperationsService } from '../access/owned-operations.service.js';
import { STORAGE_CLIENT } from '../storage/storage.tokens.js';
import { DraftKeysRepository } from './draft-keys.repository.js';
import { OperationError } from './operation.error.js';
import { hashOperation, isJson, isOperationId, parseOperationEnvelope } from './operation-parser.js';
import { OperationReceiptsRepository } from './operation-receipts.repository.js';
import { isRetryableOperationError } from './operation-retry.js';
import { RECOVERY_GENERATION, type DraftKeyResponse, type OperationHandler } from './operations.type.js';
import type { OperationConfirmation, OperationEnvelope } from './protocol.js';

const MAX_TRANSACTION_ATTEMPTS = 3;

@Injectable()
export class OperationsService<Credential> {
  constructor(
    @Inject(STORAGE_CLIENT) private readonly storage: PrismaClient,
    @Inject(OwnedOperationsService) private readonly access: OwnedOperationsService<Credential>,
    @Inject(RECOVERY_GENERATION) private readonly recoveryGeneration: string,
    @Inject(OperationReceiptsRepository) private readonly receipts: OperationReceiptsRepository,
    @Inject(DraftKeysRepository) private readonly draftKeys: DraftKeysRepository,
  ) {
    if (!recoveryGeneration.trim()) {
      throw new Error('RECOVERY_GENERATION_REQUIRED');
    }
  }

  /**
   * Повторяет целую транзакцию, сохраняя один snapshot команды и её идентификатор.
   * OPERATION_FAILED не доказывает отсутствие записи: ответ мог потеряться после commit.
   */
  async execute(credential: Credential, input: unknown, handler: OperationHandler): Promise<OperationConfirmation> {
    const command = parseOperationEnvelope(input);
    const commandHash = hashOperation(command);

    return this.withSafeErrors(() =>
      this.access.run(credential, command.athleteId, async (owner) => {
        this.assertGeneration(command.recoveryGeneration);

        for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt++) {
          try {
            return await this.storage.$transaction(
              (tx) => this.executeInTransaction(tx, credential, owner, command, commandHash, handler),
              { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
            );
          } catch (error: unknown) {
            if (!isRetryableOperationError(error) || attempt === MAX_TRANSACTION_ATTEMPTS) {
              throw error;
            }
          }
        }

        throw new OperationError('OPERATION_FAILED');
      }),
    );
  }

  async findReceipt(
    credential: Credential,
    expectedAthleteId: string,
    operationId: string,
    generation: string,
  ): Promise<OperationConfirmation | null> {
    if (!isOperationId(operationId)) {
      throw new OperationError('INVALID_OPERATION');
    }

    return this.withSafeErrors(() =>
      this.access.run(credential, expectedAthleteId, async (owner) => {
        this.assertGeneration(generation);
        const receipt = await this.receipts.findById(owner.athleteId, operationId);

        return receipt === null ? null : this.mapConfirmation(receipt);
      }),
    );
  }

  /**
   * При продолжении нужен прежний keyId: создание нового ключа вместо потерянного
   * оставило бы сохранённый ciphertext нечитаемым без явного объяснения причины.
   */
  async getDraftKey(credential: Credential, expectedAthleteId: string, expectedKeyId?: string): Promise<DraftKeyResponse> {
    return this.withSafeErrors(() =>
      this.access.run(credential, expectedAthleteId, async (owner) => {
        let record = await this.draftKeys.findByAthleteId(owner.athleteId);

        if (expectedKeyId && record?.keyId !== expectedKeyId) {
          throw new OperationError('DRAFT_KEY_MISSING');
        }

        if (record === null) {
          record = await this.draftKeys.createIfMissing(owner.athleteId);
        }

        return { keyId: record.keyId, key: Buffer.from(record.key).toString('base64') };
      }),
    );
  }

  private async executeInTransaction(
    tx: Prisma.TransactionClient,
    credential: Credential,
    owner: VerifiedAccess,
    command: OperationEnvelope,
    commandHash: string,
    handler: OperationHandler,
  ): Promise<OperationConfirmation> {
    await this.receipts.lockAthlete(tx, owner.athleteId);

    // Сессия могла быть отозвана во время ожидания блокировки. Контекст до ожидания
    // не даёт права читать квитанцию или изменять данные после него.
    return this.access.run(credential, owner.athleteId, async (verifiedOwner) => {
      this.assertGeneration(command.recoveryGeneration);
      const existing = await this.receipts.findById(verifiedOwner.athleteId, command.operationId, tx);

      // Последующие команды могли изменить редакцию. Исторический успешный повтор
      // возвращает прежнюю квитанцию до проверки актуальной редакции корня.
      if (existing !== null) {
        if (existing.commandHash !== commandHash) {
          throw new OperationError('OPERATION_ID_CONFLICT');
        }

        return this.mapConfirmation(existing);
      }

      const currentRevision = await handler.currentRevision(tx, verifiedOwner, command);
      if (currentRevision !== command.baseRevision) {
        throw new OperationError('REVISION_CONFLICT');
      }

      const applied = await handler.apply(tx, verifiedOwner, command);
      const receipt = await this.receipts.create(
        {
          athleteId: verifiedOwner.athleteId,
          command,
          commandHash,
          applied,
        },
        tx,
      );

      return this.mapConfirmation(receipt);
    });
  }

  private assertGeneration(generation: string): void {
    // Восстановление снимка могло удалить квитанцию уже принятой команды.
    // Старое поколение нельзя допускать даже до поиска этой квитанции.
    if (generation !== this.recoveryGeneration) {
      throw new OperationError('RECOVERY_GENERATION_MISMATCH');
    }
  }

  private mapConfirmation(receipt: OperationReceipt): OperationConfirmation {
    if (!isJson(receipt.result)) {
      throw new OperationError('OPERATION_FAILED');
    }

    return {
      operationId: receipt.operationId,
      recoveryGeneration: receipt.recoveryGeneration,
      revision: receipt.revision,
      result: receipt.result,
    };
  }

  private async withSafeErrors<Result>(operation: () => Promise<Result>): Promise<Result> {
    try {
      return await operation();
    } catch (error: unknown) {
      if (error instanceof OperationError || error instanceof OwnedOperationError) {
        throw error;
      }

      // Сообщения драйвера могут включать SQL, URL и личные значения.
      throw new OperationError('OPERATION_FAILED');
    }
  }
}
