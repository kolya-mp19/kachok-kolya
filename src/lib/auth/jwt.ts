import type { JWTPayload as JosePayload } from 'jose';
import { SignJWT, jwtVerify } from 'jose';

export interface JwtPayload {
  sub: string;
  email?: string;
  jti: string;
  iat: number;
  exp: number;
}

const encoder = new TextEncoder();

const accessSecret = () => encoder.encode(process.env.JWT_ACCESS_SECRET!);
const refreshSecret = () => encoder.encode(process.env.JWT_REFRESH_SECRET!);

function assertPayload(raw: JosePayload): JwtPayload {
  if (!raw.sub || !raw.jti) throw new Error('Malformed JWT payload');
  return raw as unknown as JwtPayload;
}

export async function signAccessToken(payload: {
  userId: string;
  email: string;
}): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_ACCESS_EXPIRES_IN ?? '15m')
    .setJti(crypto.randomUUID())
    .sign(accessSecret());
}

export async function signRefreshToken(payload: { userId: string }): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_REFRESH_EXPIRES_IN ?? '7d')
    .setJti(crypto.randomUUID())
    .sign(refreshSecret());
}

export async function verifyAccessToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, accessSecret());
  return assertPayload(payload);
}

export async function verifyRefreshToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, refreshSecret());
  return assertPayload(payload);
}
