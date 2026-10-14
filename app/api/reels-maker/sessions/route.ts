import { localisedApiError } from '@/app/i18n/api-error';
import { requireCreationLocale } from '@/app/i18n/api-locale';
// 릴스 제작 세션 생성/목록 API Route: Spring API의 /api/reels-maker/sessions를 프록시
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { getMutableServerApiClient } = await import('@/app/lib/api/server-client');
    const apiClient = await getMutableServerApiClient();

    const status = request.nextUrl.searchParams.get('status');
    const path = status
      ? `/api/reels-maker/sessions?status=${encodeURIComponent(status)}`
      : '/api/reels-maker/sessions';

    const response = await apiClient.get(path);

    return NextResponse.json(response.data, {
      status: response.status,
    });
  } catch (error: unknown) {
    return localisedApiError(error, '릴스 제작 세션 목록을 가져오는 중 오류가 발생했습니다.', 'REELS_MAKER_SESSIONS_ERROR');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    body.contentLocale = requireCreationLocale(body.contentLocale);
    const { getMutableServerApiClient } = await import('@/app/lib/api/server-client');
    const apiClient = await getMutableServerApiClient();

    const response = await apiClient.post('/api/reels-maker/sessions', body);

    return NextResponse.json(response.data, {
      status: response.status,
    });
  } catch (error: unknown) {
    return localisedApiError(error, '릴스 제작 세션을 생성하는 중 오류가 발생했습니다.', 'REELS_MAKER_SESSION_CREATE_ERROR');
  }
}
