import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RegistrationResponse, SessionResponse } from '../../../../contracts/email-access.js';
import { AuthRepository } from './auth.repository.js';
import { RegistrationMailService } from './registration-mail.service.js';
import { SessionService, type IssuedSession } from './session.service.js';
import { hashPassword, hashSecret, newSecret } from './auth-secrets.js';
import { AuthError } from './auth.error.js';
import type { RegistrationInput } from './auth-parser.js';

type RegistrationDelivery = { name: string; email: string; normalizedEmail: string; passwordHash: string; attemptHash: string };

@Injectable()
export class RegistrationService {
  constructor(
    @Inject(AuthRepository) private readonly registrations: AuthRepository,
    @Inject(RegistrationMailService) private readonly mail: RegistrationMailService,
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  async begin(input: RegistrationInput, attemptHash: string, ip: string): Promise<RegistrationResponse> {
    await this.checkMailLimit(input.normalizedEmail, ip);
    if (await this.registrations.emailExists(input.normalizedEmail)) {
      throw new AuthError('EMAIL_UNAVAILABLE');
    }
    const passwordHash = await hashPassword(input.password);
    return this.deliver({
      name: input.name,
      email: input.email,
      normalizedEmail: input.normalizedEmail,
      passwordHash,
      attemptHash,
    });
  }

  /**
   * Отправляет новый токен и отменяет прежний только после успешной доставки.
   * При отказе SMTP прежнее доставленное письмо остаётся пригодным до своего срока.
   */
  async resend(pendingId: string, attemptHash: string, ip: string): Promise<RegistrationResponse> {
    const pending = await this.registrations.findPending(pendingId, attemptHash);
    if (!pending || pending.cancelledAt || pending.consumedAt || pending.expiresAt <= new Date()) {
      throw new AuthError('CONFIRMATION_INVALID');
    }
    await this.checkMailLimit(pending.normalizedEmail, ip);
    const result = await this.deliver({
      name: pending.name,
      email: pending.email,
      normalizedEmail: pending.normalizedEmail,
      passwordHash: pending.passwordHash,
      attemptHash,
    });
    // Старое письмо остаётся пригодным при отказе новой отправки.
    await this.registrations.cancelRegistration(pendingId, attemptHash);
    return result;
  }

  /**
   * Однократно потребляет доставленный токен регистрации. Атлет, дневник и новая
   * сессия фиксируются вместе; конкурентный повтор не выдаёт ещё одну сессию.
   * @throws AuthError Для непригодного токена, занятой почты или превышения лимита.
   */
  async confirm(
    token: string,
    previousSession: string | undefined,
    ip: string,
  ): Promise<{ identity: SessionResponse; session: IssuedSession }> {
    if (!(await this.registrations.takeRateLimit(`confirm:ip:${hashSecret(ip)}`, 30, 900000, new Date()))) {
      throw new AuthError('RATE_LIMITED');
    }
    try {
      return await this.registrations.transaction(async (tx) => {
        const tokenHash = hashSecret(token);
        const address = await this.registrations.findRegistrationEmail(tokenHash, tx);
        if (!address) {
          throw new AuthError('CONFIRMATION_INVALID');
        }
        // Один порядок для разных писем одного адреса: сначала адрес, затем
        // строка токена. Обратный порядок дал бы deadlock при отмене других писем.
        await this.registrations.lockEmail(address.normalizedEmail, tx);
        const pending = await this.registrations.lockRegistration(tokenHash, tx);
        const now = new Date();
        if (
          !pending ||
          pending.purpose !== 'registration' ||
          !pending.deliveredAt ||
          pending.consumedAt ||
          pending.cancelledAt ||
          pending.expiresAt <= now
        ) {
          throw new AuthError('CONFIRMATION_INVALID');
        }
        if (await this.registrations.emailExists(pending.normalizedEmail, tx)) {
          throw new AuthError('EMAIL_UNAVAILABLE');
        }
        const identity = await this.registrations.createAthlete(pending, tx);
        await this.registrations.consumeRegistration(pending.id, pending.normalizedEmail, now, tx);
        const session = await this.sessions.issue(identity.athleteId, previousSession, tx);
        return { identity: { ...identity, csrfToken: session.csrfToken }, session };
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AuthError('EMAIL_UNAVAILABLE');
      }
      throw error;
    }
  }

  async cancel(pendingId: string, attemptHash: string): Promise<void> {
    await this.registrations.cancelRegistration(pendingId, attemptHash);
  }

  private async checkMailLimit(normalizedEmail: string, ip: string): Promise<void> {
    const now = new Date();
    const byIp = await this.registrations.takeRateLimit(`mail:ip:${hashSecret(ip)}`, 30, 3600000, now);
    const byEmail = await this.registrations.takeRateLimit(`mail:email:${hashSecret(normalizedEmail)}`, 5, 3600000, now);
    if (!byIp || !byEmail) {
      throw new AuthError('RATE_LIMITED');
    }
  }

  private async deliver(input: RegistrationDelivery): Promise<RegistrationResponse> {
    const token = newSecret();
    const pending = await this.registrations.createRegistration({
      ...input,
      tokenHash: hashSecret(token),
      expiresAt: new Date(Date.now() + 86400000),
    });
    try {
      // Сеть вызывается после фиксации ожидания, вне транзакции создания атлета.
      await this.mail.send(input.email, token);
      await this.registrations.markDelivery(pending.id, true);
    } catch {
      await this.registrations.markDelivery(pending.id, false);
      throw new AuthError('DELIVERY_FAILED');
    }
    return { status: 'sent', pendingId: pending.id };
  }
}
