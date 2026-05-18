import type { NextResponse } from 'next/server';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Must match JWT_ACCESS_EXPIRES_IN / JWT_REFRESH_EXPIRES_IN in .env
const ACCESS_MAX_AGE = 60 * 15;            // 15 minutes
const REFRESH_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export function setAuthCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string,
): void {
  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_MAX_AGE,
  });

  // Scoped to the refresh endpoint — browser never sends it to other routes.
  response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'lax',
    path: '/api/auth/refresh',
    maxAge: REFRESH_MAX_AGE,
  });
}

export function clearAuthCookies(response: NextResponse): void {
  response.cookies.set(ACCESS_TOKEN_COOKIE, '', {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  // Path must match exactly so the browser removes the scoped cookie.
  response.cookies.set(REFRESH_TOKEN_COOKIE, '', {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'lax',
    path: '/api/auth/refresh',
    maxAge: 0,
  });
}
