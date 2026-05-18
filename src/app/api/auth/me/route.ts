import { hash } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { users } from '@/db/schema';
import { updateProfileBodySchema } from '@/schemas/auth';
import { ACCESS_TOKEN_COOKIE } from '@/lib/auth/cookies';
import { verifyAccessToken } from '@/lib/auth/jwt';

const PASSWORD_ROUNDS = 12;

async function getAuthPayload(request: NextRequest) {
  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return null;
  return verifyAccessToken(token).catch(() => null);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const payload = await getAuthPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized', code: 'NO_TOKEN' }, { status: 401 });
    }

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        gender: users.gender,
        createdAt: users.createdAt,
        provider: users.provider,
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

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const payload = await getAuthPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized', code: 'NO_TOKEN' }, { status: 401 });
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = updateProfileBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      const { message } = parsed.error.issues[0];
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { name, gender, password, confirmPassword } = parsed.data;

    const [existing] = await db
      .select({ provider: users.provider })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const updates: Partial<typeof users.$inferInsert> = {
      name,
      gender: gender ?? null,
    };

    if (!existing.provider && password !== undefined && confirmPassword !== undefined) {
      updates.passwordHash = await hash(password, PASSWORD_ROUNDS);
    }

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, payload.sub))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        gender: users.gender,
        createdAt: users.createdAt,
        provider: users.provider,
      });

    return NextResponse.json({ user: updated });
  } catch (err) {
    console.error('[me PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
