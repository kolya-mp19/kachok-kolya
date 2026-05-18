import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { ACCESS_TOKEN_COOKIE } from '@/lib/auth/cookies';
import { verifyAccessToken } from '@/lib/auth/jwt';

const PROTECTED_PREFIXES = ['/profile', '/dashboard'];

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (!isProtected) return NextResponse.next();

  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  try {
    await verifyAccessToken(token);
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL('/', request.url));
  }
}

export const config = {
  matcher: ['/profile/:path*', '/dashboard/:path*'],
};
