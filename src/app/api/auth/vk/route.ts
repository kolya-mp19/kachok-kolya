import { NextResponse } from 'next/server';

import { generateState, setStateCookie } from '@/lib/auth/oauth';

export async function GET(): Promise<NextResponse> {
  const state = generateState();

  const url = new URL('https://oauth.vk.com/authorize');
  url.searchParams.set('client_id', process.env.VK_CLIENT_ID!);
  url.searchParams.set('redirect_uri', `${process.env.APP_URL}/api/auth/vk/callback`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'email');
  url.searchParams.set('state', state);
  url.searchParams.set('v', '5.131');

  const response = NextResponse.redirect(url.toString());
  setStateCookie(response, state);
  return response;
}
