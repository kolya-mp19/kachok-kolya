import { hash } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { refreshTokens, users } from '@/db/schema';
import { setAuthCookies } from '@/lib/auth/cookies';
import { hashToken } from '@/lib/auth/hash';
import { signAccessToken, signRefreshToken } from '@/lib/auth/jwt';

const PASSWORD_ROUNDS = 12;
const REFRESH_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

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

    const { email, password, name, gender } = body as Record<string, unknown>;

    if (typeof email !== 'string' || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 },
      );
    }
    if (typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (gender !== undefined && gender !== 'male' && gender !== 'female') {
      return NextResponse.json(
        { error: 'Gender must be "male" or "female"' },
        { status: 400 },
      );
    }

    const existing = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
      columns: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Email already in use', code: 'EMAIL_TAKEN' },
        { status: 409 },
      );
    }

    const passwordHash = await hash(password, PASSWORD_ROUNDS);

    const [user] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        name: name.trim(),
        passwordHash,
        gender: gender === 'male' || gender === 'female' ? gender : null,
      })
      .returning({ id: users.id, email: users.email, name: users.name });

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

    const response = NextResponse.json({ user }, { status: 201 });
    setAuthCookies(response, accessToken, refreshToken);
    return response;
  } catch (err) {
    console.error('[register]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
