import { Inject, Injectable } from '@nestjs/common';
import { AUTH_CONFIG, type AuthConfig } from './auth.config.js';
import { AuthRepository } from './auth.repository.js';
import { hashSecret, matchesSecret, newSecret } from './auth-secrets.js';
import { AuthError } from './auth.error.js';

export type AttemptProof = { token?: string; csrfToken?: string; origin?: string };

@Injectable()
export class AuthProtectionService {
  constructor(
    @Inject(AuthRepository) private readonly attempts: AuthRepository,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  async beginAttempt(ip: string): Promise<{ token: string; csrfToken: string }> {
    if (!(await this.attempts.takeRateLimit(`attempt:ip:${hashSecret(ip)}`, 60, 900000, new Date()))) {
      throw new AuthError('RATE_LIMITED');
    }
    const token = newSecret();
    const csrfToken = newSecret();
    await this.attempts.createAttempt({
      tokenHash: hashSecret(token),
      csrfHash: hashSecret(csrfToken),
      expiresAt: new Date(Date.now() + 1800000),
    });
    return { token, csrfToken };
  }

  async verifyAttempt(proof: AttemptProof): Promise<string> {
    if (proof.origin !== this.config.origin || !proof.token || !proof.csrfToken) {
      throw new AuthError('CSRF_INVALID');
    }
    const tokenHash = hashSecret(proof.token);
    const attempt = await this.attempts.findAttempt(tokenHash);
    if (!attempt || attempt.expiresAt <= new Date() || !matchesSecret(proof.csrfToken, attempt.csrfHash)) {
      throw new AuthError('CSRF_INVALID');
    }
    return tokenHash;
  }
}
