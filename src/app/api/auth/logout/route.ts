import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { refreshTokens } from '@/db/schema';
import { ACCESS_TOKEN_COOKIE, clearAuthCookies } from '@/lib/auth/cookies';
import { verifyAccessToken } from '@/lib/auth/jwt';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // The refresh token cookie is scoped to path /api/auth/refresh, so the browser
    // does not send it here. We identify the session via the access token (path: '/')
    // and delete all refresh tokens for that user (signs out all devices).
    const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

    if (accessToken) {
      const payload = await verifyAccessToken(accessToken).catch(() => null);
      if (payload) {
        await db.delete(refreshTokens).where(eq(refreshTokens.userId, payload.sub));
      }
    }

    const response = NextResponse.json({ success: true });
    clearAuthCookies(response);
    return response;
  } catch (err) {
    console.error('[logout]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
