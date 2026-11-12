export type AuthConfig = {
  origin: string;
  secure: boolean;
  sessionCookie: string;
  attemptCookie: string;
  smtpHost: string;
  smtpPort: number;
};

export const AUTH_CONFIG = Symbol('AUTH_CONFIG');

/** Локальный HTTP разрешён только на loopback; HTTPS никогда не откатывается в HTTP. */
export function readAuthConfig(env: NodeJS.ProcessEnv): AuthConfig {
  const origin = new URL(env.APP_ORIGIN ?? 'http://127.0.0.1:5173');
  const secure = origin.protocol === 'https:';
  const isLoopback = ['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname);
  if (
    (!secure && (origin.protocol !== 'http:' || !isLoopback)) ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash ||
    origin.username ||
    origin.password
  ) {
    throw new Error('AUTH_CONFIG_INVALID');
  }
  const smtpHost = env.SMTP_HOST ?? '127.0.0.1';
  const smtpPort = Number(env.SMTP_PORT ?? 1025);
  // Внешняя доставка отложена: принимаем только loopback либо имя Compose-сервиса.
  if (
    !['127.0.0.1', 'localhost', '::1', 'mailpit'].includes(smtpHost) ||
    !Number.isInteger(smtpPort) ||
    smtpPort < 1 ||
    smtpPort > 65535
  ) {
    throw new Error('AUTH_CONFIG_INVALID');
  }
  return {
    origin: origin.origin,
    secure,
    sessionCookie: secure ? '__Host-session' : 'local-session',
    attemptCookie: secure ? '__Host-attempt' : 'local-attempt',
    smtpHost,
    smtpPort,
  };
}
