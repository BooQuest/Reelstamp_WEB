import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { requireSameOrigin, authJson, authRouteError } from '@/app/lib/auth/route-helpers';
import { OAUTH_STATE_COOKIE } from '@/app/lib/auth/oauth-state';
import { AuthRequestError } from '@/app/lib/auth/server-errors';
export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const { provider, state } = await request.json();
    if (!['KAKAO', 'NAVER', 'GOOGLE'].includes(provider) || typeof state !== 'string' || state.length < 32 || state.length > 2048 || /[^\x21-\x7e]/.test(state)) {
      throw new AuthRequestError(400, 'INVALID_REQUEST', '올바르지 않은 요청입니다.');
    }
    (await cookies()).set(OAUTH_STATE_COOKIE, `${provider}:${state}`, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 600,
    });
    return authJson({ success: true });
  } catch (error) { return authRouteError(error); }
}
