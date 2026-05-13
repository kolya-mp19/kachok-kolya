import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { findOrCreateOAuthUser, issueSessionForUser, OAUTH_STATE_COOKIE } from '@/lib/auth/oauth';

interface YandexTokenResponse {
  access_token: string;
  error?: string;
  error_description?: string;
}

interface YandexUserInfo {
  id: string;
  real_name: string;
  default_email: string;
  login: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const storedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;

  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(`${process.env.APP_URL}/?auth_error=invalid_state`);
  }

  try {
    const tokenRes = await fetch('https://oauth.yandex.ru/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.YANDEX_CLIENT_ID!,
        client_secret: process.env.YANDEX_CLIENT_SECRET!,
        redirect_uri: `${process.env.APP_URL}/api/auth/yandex/callback`,
      }),
    });

    if (!tokenRes.ok) {
      throw new Error(`Yandex token exchange failed: ${tokenRes.status}`);
    }

    const tokenData = (await tokenRes.json()) as YandexTokenResponse;
    if (tokenData.error) {
      throw new Error(`Yandex: ${tokenData.error_description ?? tokenData.error}`);
    }

    const userRes = await fetch('https://login.yandex.ru/info?format=json', {
      headers: { Authorization: `OAuth ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      throw new Error(`Yandex user info failed: ${userRes.status}`);
    }

    const yandexUser = (await userRes.json()) as YandexUserInfo;

    const user = await findOrCreateOAuthUser({
      provider: 'yandex',
      providerId: yandexUser.id,
      email: yandexUser.default_email,
      name: yandexUser.real_name || yandexUser.login,
    });

    const response = NextResponse.redirect(`${process.env.APP_URL}/`);
    response.cookies.delete(OAUTH_STATE_COOKIE);
    await issueSessionForUser(response, user);
    return response;
  } catch (err) {
    console.error('[yandex/callback]', err);
    return NextResponse.redirect(`${process.env.APP_URL}/?auth_error=yandex_failed`);
  }
}
