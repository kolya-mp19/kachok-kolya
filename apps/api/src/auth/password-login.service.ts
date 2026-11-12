import { Inject, Injectable } from '@nestjs/common';
import type { SessionResponse } from '../../../../contracts/email-access.js';
import { AuthRepository } from './auth.repository.js';
import { PasswordLoginRepository } from './password-login.repository.js';
import { SessionService, type IssuedSession } from './session.service.js';
import { hashSecret, verifyPassword } from './auth-secrets.js';
import { AuthError } from './auth.error.js';
import type { PasswordLoginInput } from './auth-parser.js';

type PasswordLoginParams = PasswordLoginInput & { ip: string; previousSession?: string };
type PasswordLoginResult = { identity: SessionResponse; session: IssuedSession };

// Это синтетический хеш, а не способ входа. Его стоимость совпадает с настоящим
// Argon2id; отсутствие аккаунта или удалённый после восстановления БД хеш не
// должны выдавать существование адреса быстрой веткой без проверки пароля.
const dummyPasswordHash = '$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

@Injectable()
export class PasswordLoginService {
  constructor(
    @Inject(AuthRepository) private readonly auth: AuthRepository,
    @Inject(PasswordLoginRepository) private readonly passwords: PasswordLoginRepository,
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  /** Проверка пароля не держит транзакцию; перед сессией доказательство проверяется под блокировкой заново. */
  async login(input: PasswordLoginParams): Promise<PasswordLoginResult> {
    const now = new Date();
    const ipAllowed = await this.auth.takeRateLimit(`login:ip:${hashSecret(input.ip)}`, 30, 900000, now);
    const emailAllowed = await this.auth.takeRateLimit(`login:email:${hashSecret(input.normalizedEmail)}`, 10, 900000, now);
    if (!ipAllowed || !emailAllowed) {
      throw new AuthError('RATE_LIMITED');
    }
    const credential = await this.passwords.findCredential(input.normalizedEmail);
    const isValid = await verifyPassword(input.password, credential?.passwordHash ?? dummyPasswordHash);
    if (!credential?.passwordHash || !isValid) {
      throw new AuthError('INVALID_LOGIN');
    }
    return this.auth.transaction(async (tx) => {
      const identity = await this.passwords.lockIdentity(credential.athleteId, tx);
      if (
        !identity ||
        identity.passwordHash !== credential.passwordHash ||
        identity.accessRevision !== credential.accessRevision
      ) {
        throw new AuthError('INVALID_LOGIN');
      }
      const session = await this.sessions.issue(identity.athleteId, input.previousSession, tx);
      return {
        identity: { athleteId: identity.athleteId, diaryId: identity.diaryId, name: identity.name, csrfToken: session.csrfToken },
        session,
      };
    });
  }
}
