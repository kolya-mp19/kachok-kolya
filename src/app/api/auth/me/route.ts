import { hash } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { users } from '@/db/schema';
import { ACCESS_TOKEN_COOKIE } from '@/lib/auth/cookies';
import { verifyAccessToken } from '@/lib/auth/jwt';

const PASSWORD_ROUNDS = 12;

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
    const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized', code: 'NO_TOKEN' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token).catch(() => null);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized', code: 'INVALID_TOKEN' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 });
    }

    const { name, gender, password, confirmPassword } = body as Record<string, unknown>;

    if (typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Имя не может быть пустым' }, { status: 400 });
    }
    if (gender !== undefined && gender !== null && gender !== 'male' && gender !== 'female') {
      return NextResponse.json({ error: 'Неверное значение пола' }, { status: 400 });
    }

    const [existing] = await db
      .select({ provider: users.provider })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const updates: Partial<typeof users.$inferInsert> = {
      name: name.trim(),
      gender: (gender === 'male' || gender === 'female') ? gender : null,
    };

    if (!existing.provider) {
      if (password !== undefined || confirmPassword !== undefined) {
        if (typeof password !== 'string' || password.length < 8) {
          return NextResponse.json(
            { error: 'Пароль должен содержать не менее 8 символов' },
            { status: 400 },
          );
        }
        if (password !== confirmPassword) {
          return NextResponse.json({ error: 'Пароли не совпадают' }, { status: 400 });
        }
        updates.passwordHash = await hash(password, PASSWORD_ROUNDS);
      }
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
