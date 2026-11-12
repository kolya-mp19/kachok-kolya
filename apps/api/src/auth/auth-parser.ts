import { AuthError } from './auth.error.js';

export type RegistrationInput = { name: string; email: string; normalizedEmail: string; password: string };
export type PasswordLoginInput = { normalizedEmail: string; password: string };

export function parsePasswordLogin(input: unknown): PasswordLoginInput {
  const fields = objectInput(input);
  const email = typeof fields.email === 'string' ? fields.email.trim() : '';
  const password = typeof fields.password === 'string' ? fields.password : '';
  if (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || !password || password.length > 256) {
    throw new AuthError('INVALID_LOGIN');
  }
  return { normalizedEmail: email.toLowerCase(), password };
}

function objectInput(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new AuthError('INVALID_INPUT');
  }
  return input as Record<string, unknown>;
}

export function parseRegistration(input: unknown): RegistrationInput {
  const fields = objectInput(input);
  const name = typeof fields.name === 'string' ? fields.name.trim() : '';
  const email = typeof fields.email === 'string' ? fields.email.trim() : '';
  const password = typeof fields.password === 'string' ? fields.password : '';
  if (
    !name ||
    name.length > 100 ||
    email.length > 254 ||
    !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ||
    /[\r\n]/.test(email) ||
    password.length < 12 ||
    password.length > 256
  ) {
    throw new AuthError('INVALID_INPUT');
  }
  return { name, email, normalizedEmail: email.toLowerCase(), password };
}

export function parseConfirmation(input: unknown): string {
  const fields = objectInput(input);
  if (typeof fields.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(fields.token)) {
    throw new AuthError('CONFIRMATION_INVALID');
  }
  return fields.token;
}

export function parsePendingId(input: unknown): string {
  const fields = objectInput(input);
  if (
    typeof fields.pendingId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fields.pendingId)
  ) {
    throw new AuthError('INVALID_INPUT');
  }
  return fields.pendingId;
}
