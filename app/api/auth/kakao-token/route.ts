import { NextRequest, NextResponse } from 'next/server';

const KAKAO_TOKEN_URL = 'https://kauth.kakao.com/oauth/token';

type KakaoTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

type KakaoTokenRequestBody = {
  code?: string;
  redirectUri?: string;
};

const getKakaoRestApiKey = () =>
  process.env.KAKAO_REST_API_KEY || process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '서버 오류 발생';

export async function POST(request: NextRequest) {
  try {
    const { code, redirectUri } = (await request.json()) as KakaoTokenRequestBody;

    if (!code || !redirectUri) {
      return NextResponse.json(
        { success: false, message: '인가 코드와 redirectUri가 필요합니다.' },
        { status: 400 }
      );
    }

    const clientId = getKakaoRestApiKey();
    if (!clientId) {
      return NextResponse.json(
        { success: false, message: '카카오 REST API 키가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      redirect_uri: redirectUri,
      code,
    });

    const clientSecret = process.env.KAKAO_CLIENT_SECRET;
    if (clientSecret) {
      tokenBody.set('client_secret', clientSecret);
    }

    const tokenResponse = await fetch(KAKAO_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body: tokenBody,
    });

    const tokenData = (await tokenResponse.json()) as KakaoTokenResponse;

    if (!tokenResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          message: tokenData.error_description || tokenData.error || '카카오 토큰 교환 실패',
        },
        { status: tokenResponse.status }
      );
    }

    return NextResponse.json({
      success: true,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
      token_type: tokenData.token_type,
      scope: tokenData.scope,
      id_token: tokenData.id_token,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, message: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
