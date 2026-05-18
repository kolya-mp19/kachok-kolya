import { compare } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { refreshTokens, users } from '@/db/schema';
import { setAuthCookies } from '@/lib/auth/cookies';
import { hashToken } from '@/lib/auth/hash';
import { signAccessToken, signRefreshToken } from '@/lib/auth/jwt';

const REFRESH_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;

// Pre-computed bcrypt hash used when the email doesn't exist, so the response time
// is indistinguishable from a wrong-password attempt (timing oracle mitigation).
const DUMMY_HASH = '$2b$12$LCkb6BpOzjJOjXyY2s6F6.Jf5tBqQ3G6m9RpVMNkXKq8Q0zOT6rO2';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 });
    }

    const { email, password } = body as Record<string, unknown>;

    if (typeof email !== 'string' || email.trim().length === 0) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    if (typeof password !== 'string' || password.length === 0) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    const hashToCompare = user?.passwordHash ?? DUMMY_HASH;
    const valid = await compare(password, hashToCompare);

    if (!user || !valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

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

    const response = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name },
    });
    setAuthCookies(response, accessToken, refreshToken);
    return response;
  } catch (err) {
    console.error('[login]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
