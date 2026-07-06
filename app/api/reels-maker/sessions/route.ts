// 릴스 제작 세션 생성/목록 API Route: Spring API의 /api/reels-maker/sessions를 프록시
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { getServerApiClient } = await import('@/app/lib/api/server-client');
    const apiClient = await getServerApiClient();

    const status = request.nextUrl.searchParams.get('status');
    const path = status
      ? `/api/reels-maker/sessions?status=${encodeURIComponent(status)}`
      : '/api/reels-maker/sessions';

    const response = await apiClient.get(path);

    return NextResponse.json(response.data, {
      status: response.status,
    });
  } catch (error: any) {
    console.error('[ReelsMakerSessions API Error]', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });

    const status = error.response?.status || 500;
    const message =
      error.response?.data?.message || '릴스 제작 세션 목록을 가져오는 중 오류가 발생했습니다.';

    return NextResponse.json(
      {
        success: false,
        status,
        message,
        errorCode: error.response?.data?.errorCode || 'REELS_MAKER_SESSIONS_ERROR',
        data: null,
      },
      { status }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { getServerApiClient } = await import('@/app/lib/api/server-client');
    const apiClient = await getServerApiClient();

    const response = await apiClient.post('/api/reels-maker/sessions', body);

    return NextResponse.json(response.data, {
      status: response.status,
    });
  } catch (error: any) {
    console.error('[ReelsMakerSessionCreate API Error]', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });

    const status = error.response?.status || 500;
    const message =
      error.response?.data?.message || '릴스 제작 세션을 생성하는 중 오류가 발생했습니다.';

    return NextResponse.json(
      {
        success: false,
        status,
        message,
        errorCode: error.response?.data?.errorCode || 'REELS_MAKER_SESSION_CREATE_ERROR',
        data: null,
      },
      { status }
    );
  }
}
