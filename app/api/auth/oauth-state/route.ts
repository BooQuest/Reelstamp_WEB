import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { requireSameOrigin, readAuthRequestBody, authJson, authRouteError } from '@/app/lib/auth/route-helpers';
import { createGoogleOAuthNonce, OAUTH_STATE_COOKIE } from '@/app/lib/auth/oauth-state';
import { AuthRequestError } from '@/app/lib/auth/server-errors';
import { googleWebConfig } from '@/app/lib/auth/google-web-config';

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const { provider, state } = await readAuthRequestBody(request);
    if (typeof provider !== 'string' || !['KAKAO', 'NAVER', 'GOOGLE'].includes(provider) || typeof state !== 'string' || state.length < 32 || state.length > 2048 || /[^\x21-\x7e]/.test(state)) {
      throw new AuthRequestError(400, 'INVALID_REQUEST', '올바르지 않은 요청입니다.');
    }
    let cookieValue = `${provider}:${state}`;
    let authorizationUrl: string | undefined;
    if (provider === 'GOOGLE') {
      const { clientId } = googleWebConfig();
      const nonce = createGoogleOAuthNonce();
      const authorization = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authorization.search = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: `${request.headers.get('origin')}/login`,
        scope: 'openid email profile',
        state,
        nonce,
      }).toString();
      authorizationUrl = authorization.toString();
      cookieValue = `GOOGLE:${nonce}:${state}`;
    }

    (await cookies()).set(OAUTH_STATE_COOKIE, cookieValue, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 600,
    });
    return authJson({ success: true, authorizationUrl });
  } catch (error) { return authRouteError(error); }
}
