// 카카오 로그인 Route Handler: Spring API 호출 후 httpOnly 쿠키에 토큰 저장
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { webApiClient } from '@/app/lib/api/client';
import { WebApiResponse, LoginResponseData, normalizeUserInfo } from '@/app/lib/api/auth';

type RouteError = {
  message?: string;
  response?: {
    status?: number;
    data?: {
      message?: string;
    };
  };
};

const toRouteError = (error: unknown): RouteError => {
  if (error && typeof error === 'object') {
    return error as RouteError;
  }
  return {};
};

export async function POST(request: NextRequest) {
  try {
    const { kakaoAccessToken } = await request.json();

    if (!kakaoAccessToken) {
      return NextResponse.json(
        { success: false, message: '카카오 액세스 토큰이 필요합니다.' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const guestAccessToken =
      cookieStore.get('accessToken')?.value ?? cookieStore.get('refreshToken')?.value;

    const response = await webApiClient.post<WebApiResponse<LoginResponseData>>(
      '/api/auth/login',
      {
        accessToken: kakaoAccessToken,
        provider: 'KAKAO',
        guestAccessToken,
      }
    );

    const { tokenInfo, userInfo } = response.data.data;
    const normalizedUserInfo = normalizeUserInfo(userInfo, 'KAKAO');

    cookieStore.set('accessToken', tokenInfo.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokenInfo.expiresIn,
      path: '/',
    });

    cookieStore.set('refreshToken', tokenInfo.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return NextResponse.json({
      success: true,
      message: '로그인 성공',
      userInfo: normalizedUserInfo,
    });
  } catch (error: unknown) {
    const routeError = toRouteError(error);
    const errorMessage =
      routeError.response?.data?.message ||
      routeError.message ||
      '로그인 처리 중 오류가 발생했습니다.';

    return NextResponse.json(
      {
        success: false,
        message: errorMessage,
      },
      { status: routeError.response?.status || 500 }
    );
  }
}
