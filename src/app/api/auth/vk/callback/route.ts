import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { findOrCreateOAuthUser, issueSessionForUser, OAUTH_STATE_COOKIE } from '@/lib/auth/oauth';

interface VkTokenResponse {
  access_token: string;
  user_id: number;
  email?: string;
  error?: string;
  error_description?: string;
}

interface VkUser {
  id: number;
  first_name: string;
  last_name: string;
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
    const tokenUrl = new URL('https://oauth.vk.com/access_token');
    tokenUrl.searchParams.set('client_id', process.env.VK_CLIENT_ID!);
    tokenUrl.searchParams.set('client_secret', process.env.VK_CLIENT_SECRET!);
    tokenUrl.searchParams.set('redirect_uri', `${process.env.APP_URL}/api/auth/vk/callback`);
    tokenUrl.searchParams.set('code', code);

    const tokenRes = await fetch(tokenUrl.toString());
    if (!tokenRes.ok) {
      throw new Error(`VK token exchange failed: ${tokenRes.status}`);
    }

    const tokenData = (await tokenRes.json()) as VkTokenResponse;
    if (tokenData.error) {
      throw new Error(`VK: ${tokenData.error_description ?? tokenData.error}`);
    }

    const userUrl = new URL('https://api.vk.com/method/users.get');
    userUrl.searchParams.set('user_ids', String(tokenData.user_id));
    userUrl.searchParams.set('fields', 'first_name,last_name');
    userUrl.searchParams.set('access_token', tokenData.access_token);
    userUrl.searchParams.set('v', '5.131');

    const userRes = await fetch(userUrl.toString());
    if (!userRes.ok) {
      throw new Error(`VK user info failed: ${userRes.status}`);
    }

    const userData = (await userRes.json()) as { response: VkUser[] };
    const vkUser = userData.response[0];
    if (!vkUser) {
      throw new Error('No VK user data returned');
    }

    // VK may not provide email — use a stable placeholder when absent.
    const email = tokenData.email ?? `vk_${tokenData.user_id}@vk.placeholder.local`;
    const name = `${vkUser.first_name} ${vkUser.last_name}`.trim();

    const user = await findOrCreateOAuthUser({
      provider: 'vk',
      providerId: String(tokenData.user_id),
      email,
      name,
    });

    const response = NextResponse.redirect(`${process.env.APP_URL}/`);
    response.cookies.delete(OAUTH_STATE_COOKIE);
    await issueSessionForUser(response, user);
    return response;
  } catch (err) {
    console.error('[vk/callback]', err);
    return NextResponse.redirect(`${process.env.APP_URL}/?auth_error=vk_failed`);
  }
}
