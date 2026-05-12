import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { users } from '@/db/schema';
import { ACCESS_TOKEN_COOKIE } from '@/lib/auth/cookies';
import { verifyAccessToken } from '@/lib/auth/jwt';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized', code: 'NO_TOKEN' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token).catch(() => null);
    if (!payload) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'INVALID_TOKEN' },
        { status: 401 },
      );
    }

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        gender: users.gender,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (err) {
    console.error('[me]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
