import { Inject, Injectable } from '@nestjs/common';
import type { RecoveryResponse } from '../../../../contracts/email-access.js';
import { AuthRepository } from './auth.repository.js';
import { PasswordRecoveryRepository } from './password-recovery.repository.js';
import { PasswordLoginRepository } from './password-login.repository.js';
import { EmailActionMailService } from './email-action-mail.service.js';
import { hashPassword, hashSecret, newSecret } from './auth-secrets.js';
import { AuthError } from './auth.error.js';

type RecoveryStart = { normalizedEmail: string; attemptHash: string; ip: string };
type RecoveryReset = { token: string; password: string; ip: string };

@Injectable()
export class PasswordRecoveryService {
  constructor(
    @Inject(AuthRepository) private readonly auth: AuthRepository,
    @Inject(PasswordRecoveryRepository) private readonly recoveries: PasswordRecoveryRepository,
    @Inject(PasswordLoginRepository) private readonly passwords: PasswordLoginRepository,
    @Inject(EmailActionMailService) private readonly mail: EmailActionMailService,
  ) {}

  /**
   * Нейтральный результат не подтверждает адрес и доставку. Отказ SMTP отменяет
   * только новый токен; публичная разница ответов раскрыла бы существование почты.
   */
  async begin(input: RecoveryStart): Promise<RecoveryResponse> {
    await this.checkMailLimit(input.normalizedEmail, input.ip);
    const account = await this.recoveries.findAccount(input.normalizedEmail);
    const token = newSecret();
    const pending = await this.recoveries.create({
      normalizedEmail: input.normalizedEmail,
      athleteId: account?.id ?? null,
      accessRevision: account?.accessRevision ?? null,
      attemptHash: input.attemptHash,
      tokenHash: hashSecret(token),
      expiresAt: new Date(Date.now() + 1800000),
    });
    if (account) {
      let isDelivered = false;
      try {
        await this.mail.sendRecovery(account.email, token);
        isDelivered = true;
      } catch (error: unknown) {
        // Подавляем только ожидаемый отказ канала, без SMTP-текста с адресом/токеном.
        if (!(error instanceof AuthError) || error.code !== 'DELIVERY_FAILED') {
          throw error;
        }
      }
      await this.recoveries.markDelivery(pending.id, isDelivered);
    }
    return { status: 'accepted', pendingId: pending.id };
  }

  async resend(pendingId: string, attemptHash: string, ip: string): Promise<RecoveryResponse> {
    const pending = await this.recoveries.findPending(pendingId, attemptHash);
    if (!pending || pending.cancelledAt || pending.consumedAt || pending.expiresAt <= new Date()) {
      throw new AuthError('CONFIRMATION_INVALID');
    }
    // Новое письмо не отменяет пригодную старую ссылку при отказе SMTP.
    // Успешный reset аннулирует все ссылки владельца, включая повторные.
    return this.begin({ normalizedEmail: pending.normalizedEmail, attemptHash, ip });
  }

  async cancel(pendingId: string, attemptHash: string): Promise<void> {
    await this.recoveries.cancel(pendingId, attemptHash);
  }

  async confirm(input: RecoveryReset): Promise<void> {
    if (!(await this.auth.takeRateLimit(`recovery-confirm:ip:${hashSecret(input.ip)}`, 30, 900000, new Date()))) {
      throw new AuthError('RATE_LIMITED');
    }
    const tokenHash = hashSecret(input.token);
    const pending = await this.recoveries.findToken(tokenHash);
    if (!pending?.athleteId) {
      throw new AuthError('CONFIRMATION_INVALID');
    }
    const athleteId = pending.athleteId;
    // Дорогой Argon2id не держит транзакцию. Полная пригодность токена и
    // редакция владельца повторно проверяются после общей блокировки.
    const passwordHash = await hashPassword(input.password);
    await this.auth.transaction(async (tx) => {
      const identity = await this.passwords.lockIdentity(athleteId, tx);
      const locked = await this.recoveries.lockToken(tokenHash, tx);
      const now = new Date();
      if (
        !identity ||
        !locked ||
        locked.athleteId !== identity.athleteId ||
        locked.purpose !== 'recovery' ||
        !locked.deliveredAt ||
        locked.consumedAt ||
        locked.cancelledAt ||
        locked.expiresAt <= now ||
        locked.accessRevision !== identity.accessRevision
      ) {
        throw new AuthError('CONFIRMATION_INVALID');
      }
      await this.recoveries.resetPassword({ athleteId: identity.athleteId, recoveryId: locked.id, passwordHash, now }, tx);
    });
  }

  private async checkMailLimit(normalizedEmail: string, ip: string): Promise<void> {
    const now = new Date();
    const byIp = await this.auth.takeRateLimit(`recovery-mail:ip:${hashSecret(ip)}`, 30, 3600000, now);
    const byEmail = await this.auth.takeRateLimit(`recovery-mail:email:${hashSecret(normalizedEmail)}`, 5, 3600000, now);
    if (!byIp || !byEmail) {
      throw new AuthError('RATE_LIMITED');
    }
  }
}
