import { NextRequest, NextResponse } from 'next/server';

const KAKAO_AUTHORIZE_URL = 'https://kauth.kakao.com/oauth/authorize';

const getKakaoRestApiKey = () =>
  process.env.KAKAO_REST_API_KEY || process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY;

const getSafeRedirectUri = (request: NextRequest) => {
  const redirectUri = request.nextUrl.searchParams.get('redirectUri');
  const fallbackRedirectUri = `${request.nextUrl.origin}/login`;

  if (!redirectUri) {
    return fallbackRedirectUri;
  }

  try {
    const parsedRedirectUri = new URL(redirectUri);
    if (parsedRedirectUri.origin !== request.nextUrl.origin) {
      return null;
    }
    if (parsedRedirectUri.pathname !== '/login') {
      return null;
    }
    return parsedRedirectUri.toString();
  } catch {
    return null;
  }
};

export async function GET(request: NextRequest) {
  const clientId = getKakaoRestApiKey();
  if (!clientId) {
    return NextResponse.json(
      { success: false, message: '카카오 REST API 키가 설정되지 않았습니다.' },
      { status: 500 }
    );
  }

  const redirectUri = getSafeRedirectUri(request);
  if (!redirectUri) {
    return NextResponse.json(
      { success: false, message: '허용되지 않은 카카오 Redirect URI입니다.' },
      { status: 400 }
    );
  }

  const state = request.nextUrl.searchParams.get('state');
  const authorizeUrl = new URL(KAKAO_AUTHORIZE_URL);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);

  if (state) {
    authorizeUrl.searchParams.set('state', state);
  }

  return NextResponse.redirect(authorizeUrl);
}
