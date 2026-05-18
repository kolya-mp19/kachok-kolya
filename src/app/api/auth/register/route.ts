import { hash } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { refreshTokens, users } from '@/db/schema';
import { registerBodySchema } from '@/schemas/auth';
import { setAuthCookies } from '@/lib/auth/cookies';
import { hashToken } from '@/lib/auth/hash';
import { signAccessToken, signRefreshToken } from '@/lib/auth/jwt';

const PASSWORD_ROUNDS = 12;
const REFRESH_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = registerBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      const { message } = parsed.error.issues[0];
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { email, password, name, gender } = parsed.data;

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
        name,
        passwordHash,
        gender: gender ?? null,
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
