import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { NextResponse } from 'next/server';

import { db } from '@/db';
import { refreshTokens, users } from '@/db/schema';
import { setAuthCookies } from '@/lib/auth/cookies';
import { hashToken } from '@/lib/auth/hash';
import { signAccessToken, signRefreshToken } from '@/lib/auth/jwt';

export const OAUTH_STATE_COOKIE = 'oauth_state';
const REFRESH_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;

export function generateState(): string {
  return nanoid(32);
}

export async function findOrCreateOAuthUser(opts: {
  provider: string;
  providerId: string;
  email: string;
  name: string;
}): Promise<{ id: string; email: string; name: string }> {
  const { provider, providerId, email, name } = opts;

  const existing = await db.query.users.findFirst({
    where: and(eq(users.provider, provider), eq(users.providerId, providerId)),
  });

  if (existing) {
    return { id: existing.id, email: existing.email, name: existing.name };
  }

  // Link OAuth to an existing email account if one exists.
  const byEmail = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (byEmail) {
    await db.update(users).set({ provider, providerId }).where(eq(users.id, byEmail.id));
    return { id: byEmail.id, email: byEmail.email, name: byEmail.name };
  }

  const [created] = await db
    .insert(users)
    .values({ email, name, provider, providerId })
    .returning({ id: users.id, email: users.email, name: users.name });

  return created;
}

export async function issueSessionForUser(
  response: NextResponse,
  user: { id: string; email: string },
): Promise<void> {
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken({ userId: user.id, email: user.email }),
    signRefreshToken({ userId: user.id }),
  ]);

  const tokenHash = await hashToken(refreshToken);
  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt: new Date(Date.now() + REFRESH_EXPIRES_MS),
  });

  setAuthCookies(response, accessToken, refreshToken);
}

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export function setStateCookie(response: NextResponse, state: string): void {
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PRODUCTION,
    maxAge: 600,
    path: '/',
  });
}
