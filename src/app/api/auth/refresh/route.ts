import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { refreshTokens, users } from '@/db/schema';
import { REFRESH_TOKEN_COOKIE, setAuthCookies } from '@/lib/auth/cookies';
import { compareToken, hashToken } from '@/lib/auth/hash';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '@/lib/auth/jwt';

const REFRESH_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const rawToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

    if (!rawToken) {
      return NextResponse.json(
        { error: 'Refresh token missing', code: 'NO_TOKEN' },
        { status: 401 },
      );
    }

    const payload = await verifyRefreshToken(rawToken).catch(() => null);
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid refresh token', code: 'INVALID_TOKEN' },
        { status: 401 },
      );
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.sub),
      columns: { id: true, email: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    // bcrypt has no indexed lookup — compare each record for this user until match found.
    const records = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.userId, payload.sub));

    let matched: (typeof records)[number] | null = null;
    for (const record of records) {
      if (await compareToken(rawToken, record.tokenHash)) {
        matched = record;
        break;
      }
    }

    if (!matched) {
      return NextResponse.json(
        { error: 'Refresh token not recognized', code: 'INVALID_TOKEN' },
        { status: 401 },
      );
    }

    if (matched.expiresAt < new Date()) {
      await db.delete(refreshTokens).where(eq(refreshTokens.id, matched.id));
      return NextResponse.json(
        { error: 'Refresh token expired', code: 'TOKEN_EXPIRED' },
        { status: 401 },
      );
    }

    const [newAccessToken, newRefreshToken] = await Promise.all([
      signAccessToken({ userId: user.id, email: user.email }),
      signRefreshToken({ userId: user.id }),
    ]);

    const newTokenHash = await hashToken(newRefreshToken);
    // Capture before the async closure so TypeScript narrowing is preserved.
    const matchedId = matched.id;

    await db.transaction(async (tx) => {
      await tx.delete(refreshTokens).where(eq(refreshTokens.id, matchedId));
      await tx.insert(refreshTokens).values({
        userId: user.id,
        tokenHash: newTokenHash,
        expiresAt: new Date(Date.now() + REFRESH_EXPIRES_MS),
      });
    });

    const response = NextResponse.json({ success: true });
    setAuthCookies(response, newAccessToken, newRefreshToken);
    return response;
  } catch (err) {
    console.error('[refresh]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
