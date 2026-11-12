import { Body, Controller, Get, Inject, Post, Req, Res } from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import type { AuthAttemptResponse, RegistrationResponse, SessionResponse } from '../../../../contracts/email-access.js';
import { AUTH_CONFIG, type AuthConfig } from './auth.config.js';
import { AuthProtectionService } from './auth-protection.service.js';
import { parseConfirmation, parsePendingId, parseRegistration, parsePasswordLogin } from './auth-parser.js';
import { PasswordLoginService } from './password-login.service.js';
import { RegistrationService } from './registration.service.js';
import { SessionService } from './session.service.js';

// Непрозрачные токены не требуют общего cookie-parser; дубликаты считаем непригодными.
function readCookie(request: Request, name: string): string | undefined {
  const values = (request.headers.cookie ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`));
  if (values.length !== 1) {
    return undefined;
  }
  const value = values[0].slice(name.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : undefined;
}

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
    @Inject(AuthProtectionService) private readonly protection: AuthProtectionService,
    @Inject(RegistrationService) private readonly registration: RegistrationService,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(PasswordLoginService) private readonly passwords: PasswordLoginService,
  ) {}

  @Get('attempt')
  async attempt(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<AuthAttemptResponse> {
    this.preventCache(response);
    const attempt = await this.protection.beginAttempt(this.ip(request));
    response.cookie(this.config.attemptCookie, attempt.token, { ...this.cookieOptions(), maxAge: 1800000 });
    return { csrfToken: attempt.csrfToken };
  }

  @Post('registration')
  async begin(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RegistrationResponse> {
    this.preventCache(response);
    const attemptHash = await this.verify(request);
    return this.registration.begin(parseRegistration(body), attemptHash, this.ip(request));
  }

  @Post('registration/resend')
  async resend(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RegistrationResponse> {
    this.preventCache(response);
    const attemptHash = await this.verify(request);
    return this.registration.resend(parsePendingId(body), attemptHash, this.ip(request));
  }

  @Post('registration/cancel')
  async cancel(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ status: 'cancelled' }> {
    this.preventCache(response);
    const attemptHash = await this.verify(request);
    await this.registration.cancel(parsePendingId(body), attemptHash);
    return { status: 'cancelled' };
  }

  @Post('registration/confirm')
  async confirm(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionResponse> {
    this.preventCache(response);
    await this.verify(request);
    const result = await this.registration.confirm(
      parseConfirmation(body),
      readCookie(request, this.config.sessionCookie),
      this.ip(request),
    );
    response.cookie(this.config.sessionCookie, result.session.token, {
      ...this.cookieOptions(),
      expires: result.session.expiresAt,
    });
    return result.identity;
  }

  @Get('session')
  async session(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<SessionResponse> {
    this.preventCache(response);
    return this.sessions.getIdentity(readCookie(request, this.config.sessionCookie));
  }

  private verify(request: Request): Promise<string> {
    return this.protection.verifyAttempt({
      token: readCookie(request, this.config.attemptCookie),
      csrfToken: request.get('X-CSRF-Token'),
      origin: request.get('Origin'),
    });
  }

  @Post('login')
  async login(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionResponse> {
    this.preventCache(response);
    await this.verify(request);
    const result = await this.passwords.login({
      ...parsePasswordLogin(body),
      ip: this.ip(request),
      previousSession: readCookie(request, this.config.sessionCookie),
    });
    response.cookie(this.config.sessionCookie, result.session.token, {
      ...this.cookieOptions(),
      expires: result.session.expiresAt,
    });
    return result.identity;
  }

  private ip(request: Request): string {
    // Не доверяем X-Forwarded-For: API слушает loopback, Vite не назначает владельца.
    // В dev proxy телефоны делят IP-лимит машины, адресный лимит остаётся отдельным.
    return request.socket.remoteAddress ?? 'unknown';
  }

  private preventCache(response: Response): void {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
  }

  private cookieOptions(): CookieOptions {
    return { httpOnly: true, secure: this.config.secure, sameSite: 'lax', path: '/' };
  }
}
