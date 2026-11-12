import { Inject, Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { AUTH_CONFIG, type AuthConfig } from './auth.config.js';
import { AuthError } from './auth.error.js';

type MailDelivery = { email: string; subject: string; text: string };

@Injectable()
export class EmailActionMailService {
  constructor(@Inject(AUTH_CONFIG) private readonly config: AuthConfig) {}

  async send(email: string, token: string): Promise<void> {
    // Фрагмент не отправляется серверу при GET и не попадает в access logs.
    const link = `${this.config.origin}/diary#confirm=${token}`;
    await this.deliver({
      email,
      subject: 'Подтвердите почту для дневника',
      text: `Чтобы создать личный дневник, откройте ссылку и нажмите «Подтвердить почту»:\n${link}\n\nСсылка действует 24 часа и используется один раз. Если вы не запрашивали регистрацию, не подтверждайте её.`,
    });
  }

  async sendRecovery(email: string, token: string): Promise<void> {
    const link = `${this.config.origin}/diary#recover=${token}`;
    await this.deliver({
      email,
      subject: 'Восстановление доступа к дневнику',
      text: `Чтобы установить новый пароль к прежнему дневнику, откройте ссылку:\n${link}\n\nСсылка действует 30 минут и используется один раз. Запрос письма не меняет пароль. Если вы не запрашивали восстановление, не открывайте ссылку.`,
    });
  }

  private async deliver(input: MailDelivery): Promise<void> {
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
      const result = await transport.sendMail({
        from: 'Качок Коля <diary@kachok.local>',
        to: input.email,
        subject: input.subject,
        text: input.text,
        disableFileAccess: true,
        disableUrlAccess: true,
      });
      if (result.accepted.length !== 1 || result.rejected.length) {
        throw new AuthError('DELIVERY_FAILED');
      }
    } catch {
      // SMTP-ошибка может содержать адрес, письмо и токен. В публичный контракт
      // и журналы передаётся только безопасный код. Сценарий отдельно фиксирует
      // непригодность регистрации либо отказ доставки восстановления.
      throw new AuthError('DELIVERY_FAILED');
    } finally {
      transport.close();
    }
  }
}
