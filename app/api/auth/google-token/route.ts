import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { normalizeUserInfo, type LoginResponseData, type WebApiResponse } from '@/app/lib/api/auth';
import { googleWebConfig } from '@/app/lib/auth/google-web-config';
import { validateOAuthExchange } from '@/app/lib/auth/oauth-state';
import { requireTokenInfo } from '@/app/lib/auth/refresh';
import { authJson, authRouteError, readAuthRequestBody } from '@/app/lib/auth/route-helpers';
import { AuthRequestError, unavailableAuth } from '@/app/lib/auth/server-errors';
import { saveTokenCookies } from '@/app/lib/auth/token-cookies';
import { API_CONFIG } from '@/app/lib/constants/api';

export async function POST(request: NextRequest) {
  try {
    const { code, redirectUri, state } = await readAuthRequestBody(request);
    if (typeof code !== 'string' || !code || typeof redirectUri !== 'string') {
      throw new AuthRequestError(400, 'INVALID_REQUEST', '인가 코드와 복귀 주소가 필요합니다.');
    }
    const nonce = await validateOAuthExchange(request, 'GOOGLE', state, redirectUri);
    if (!nonce) throw unavailableAuth();
    const { clientId, clientSecret, bffSecret } = googleWebConfig();

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenResponse.ok) {
      if (tokenResponse.status === 429 || tokenResponse.status >= 500) throw unavailableAuth();
      throw new AuthRequestError(401, 'INVALID_TOKEN', 'Google 로그인을 다시 시작해 주세요.');
    }
    const { id_token: idToken } = await tokenResponse.json();
    if (typeof idToken !== 'string' || !idToken) {
      throw new AuthRequestError(401, 'INVALID_TOKEN', 'Google 로그인을 다시 시작해 주세요.');
    }

    const store = await cookies();
    // Backend checks if this credential belongs to a guest after verifying the Google identity.
    const priorCredential = store.get('refreshToken')?.value || store.get('accessToken')?.value;
    const response = await fetch(`${API_CONFIG.WEB_BASE_URL}/api/auth/google/web/login`, {
      method: 'POST',
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': request.headers.get('user-agent') || 'Unknown',
        'X-Reelstamp-Google-Web-Secret': bffSecret,
        ...(priorCredential ? { 'X-Guest-Access-Token': priorCredential } : {}),
      },
      body: JSON.stringify({ idToken, nonce }),
    });
    if (!response.ok) {
      throw new AuthRequestError(response.status, 'GOOGLE_LOGIN_FAILED', 'Google 로그인에 실패했습니다.');
    }
    const { success, data } = await response.json() as WebApiResponse<LoginResponseData>;
    if (!success || !data?.userInfo) throw unavailableAuth();
    const { id, userId, providerUserId, email, nickname, socialNickname, profileImageUrl, role } = data.userInfo;
    const userInfo = normalizeUserInfo({ id, userId, providerUserId, email, nickname, socialNickname, profileImageUrl, role }, 'GOOGLE');
    if (!Number.isSafeInteger(userInfo.id) || userInfo.id <= 0) throw unavailableAuth();

    saveTokenCookies(store, requireTokenInfo(data.tokenInfo));
    return authJson({ success: true, message: '로그인 성공', userInfo });
  } catch (error: unknown) {
    return authRouteError(error);
  }
}
