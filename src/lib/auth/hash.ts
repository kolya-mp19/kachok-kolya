import { compare, hash } from 'bcryptjs';

const ROUNDS = 10;

// bcryptjs silently truncates inputs over 72 bytes. JWTs are typically 200-400 bytes
// and their signature (the uniquely random part) lives past that boundary.
// SHA-256 collapses the token to 64 hex chars before bcrypt sees it.
async function digest(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashToken(token: string): Promise<string> {
  return hash(await digest(token), ROUNDS);
}

export async function compareToken(token: string, stored: string): Promise<boolean> {
  return compare(await digest(token), stored);
}
