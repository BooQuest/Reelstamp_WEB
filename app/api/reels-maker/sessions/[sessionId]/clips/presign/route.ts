// 릴스 제작 클립 업로드 presign API Route: Spring API의 /api/reels-maker/sessions/{id}/clips/presign를 프록시
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId?: string } | Promise<{ sessionId?: string }> }
) {
  try {
    const body = await request.json();
    const { getServerApiClient } = await import('@/app/lib/api/server-client');
    const apiClient = await getServerApiClient();

    const resolvedParams = await Promise.resolve(params);
    const rawSessionId =
      resolvedParams?.sessionId || request.nextUrl.pathname.split('/').pop();
    if (!rawSessionId) {
      return NextResponse.json(
        {
          success: false,
          status: 400,
          message: 'sessionId가 필요합니다.',
          errorCode: 'INVALID_REQUEST',
          data: null,
        },
        { status: 400 }
      );
    }

    const response = await apiClient.post(
      `/api/reels-maker/sessions/${rawSessionId}/clips/presign`,
      body
    );

    return NextResponse.json(response.data, {
      status: response.status,
    });
  } catch (error: any) {
    console.error('[ReelsMakerClipPresign API Error]', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });

    const status = error.response?.status || 500;
    const message =
      error.response?.data?.message || '클립 업로드 URL을 발급하는 중 오류가 발생했습니다.';

    return NextResponse.json(
      {
        success: false,
        status,
        message,
        errorCode: error.response?.data?.errorCode || 'REELS_MAKER_CLIP_PRESIGN_ERROR',
        data: null,
      },
      { status }
    );
  }
}
