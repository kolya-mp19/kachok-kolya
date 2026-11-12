import { Inject, Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { AUTH_CONFIG, type AuthConfig } from './auth.config.js';
import { AuthError } from './auth.error.js';

@Injectable()
export class RegistrationMailService {
  constructor(@Inject(AUTH_CONFIG) private readonly config: AuthConfig) {}

  async send(email: string, token: string): Promise<void> {
    const transport = nodemailer.createTransport({
      host: this.config.smtpHost,
      port: this.config.smtpPort,
      secure: false,
      ignoreTLS: true,
      connectionTimeout: 3000,
      greetingTimeout: 3000,
      socketTimeout: 5000,
      logger: false,
      debug: false,
    });
    try {
      // Фрагмент не отправляется серверу при GET и не попадает в access logs.
      const link = `${this.config.origin}/diary#confirm=${token}`;
      const result = await transport.sendMail({
        from: 'Качок Коля <diary@kachok.local>',
        to: email,
        subject: 'Подтвердите почту для дневника',
        text: `Чтобы создать личный дневник, откройте ссылку и нажмите «Подтвердить почту»:\n${link}\n\nСсылка действует 24 часа и используется один раз. Если вы не запрашивали регистрацию, не подтверждайте её.`,
        disableFileAccess: true,
        disableUrlAccess: true,
      });
      if (result.accepted.length !== 1 || result.rejected.length) {
        throw new AuthError('DELIVERY_FAILED');
      }
    } catch {
      // SMTP-ошибка может содержать адрес, письмо и токен. В публичный контракт
      // и журналы передаётся только безопасный код; ожидающая запись отменяется.
      throw new AuthError('DELIVERY_FAILED');
    } finally {
      transport.close();
    }
  }
}
