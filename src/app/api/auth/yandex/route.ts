import { NextResponse } from 'next/server';

import { generateState, setStateCookie } from '@/lib/auth/oauth';

export async function GET(): Promise<NextResponse> {
  const state = generateState();

  const url = new URL('https://oauth.yandex.ru/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', process.env.YANDEX_CLIENT_ID!);
  url.searchParams.set('redirect_uri', `${process.env.APP_URL}/api/auth/yandex/callback`);
  url.searchParams.set('state', state);

  const response = NextResponse.redirect(url.toString());
  setStateCookie(response, state);
  return response;
}
