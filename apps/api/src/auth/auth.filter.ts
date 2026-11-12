import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { AuthError } from './auth.error.js';

/** Ошибки ORM/SMTP никогда не сериализуются вместе с входными значениями и секретами. */
@Catch()
export class AuthFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    // JSON parser ошибается до выбора контроллера и может включать в message
    // фрагмент пароля. Этот фильтр ставится глобально и не читает сырой message.
    let code = 'AUTH_UNAVAILABLE';
    if (error instanceof AuthError) {
      code = error.code;
    } else if (error instanceof HttpException) {
      code = 'INVALID_REQUEST';
    }
    const statuses: Record<string, number> = {
      INVALID_INPUT: 400,
      INVALID_LOGIN: 401,
      ACCESS_REQUIRED: 401,
      CSRF_INVALID: 403,
      EMAIL_UNAVAILABLE: 409,
      CONFIRMATION_INVALID: 400,
      DELIVERY_FAILED: 503,
      RATE_LIMITED: 429,
    };
    if (code === 'RATE_LIMITED') {
      response.setHeader('Retry-After', '900');
    }
    response.setHeader('Cache-Control', 'no-store');
    const status = error instanceof HttpException ? error.getStatus() : (statuses[code] ?? 503);
    response.status(status).json({ code, operationId: randomUUID() });
  }
}
