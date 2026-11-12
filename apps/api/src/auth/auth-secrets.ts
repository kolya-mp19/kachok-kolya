import { argon2, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export function newSecret(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function matchesSecret(secret: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashSecret(secret), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function derivePassword(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    argon2(
      'argon2id',
      { message: password, nonce: salt, memory: 65536, passes: 3, parallelism: 4, tagLength: 32 },
      (error, key) => {
        if (error) {
          reject(new Error('PASSWORD_HASH_FAILED'));
          return;
        }
        resolve(key);
      },
    );
  });
}

/** PHC-формат фиксирует выбранную стоимость; пароль и индивидуальная соль не переиспользуются. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derivePassword(password, salt);
  return `$argon2id$v=19$m=65536,t=3,p=4$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const match = /^\$argon2id\$v=19\$m=65536,t=3,p=4\$([A-Za-z0-9+/]{22}==)\$([A-Za-z0-9+/]{43}=)$/.exec(encoded);
  if (!match) {
    return false;
  }
  const key = await derivePassword(password, Buffer.from(match[1], 'base64'));
  return timingSafeEqual(key, Buffer.from(match[2], 'base64'));
}
