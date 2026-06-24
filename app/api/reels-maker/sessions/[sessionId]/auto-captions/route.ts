import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId?: string }> }
) {
  try {
    const { sessionId } = await params;
    if (!sessionId) {
      return NextResponse.json(
        { success: false, message: 'sessionId가 필요합니다.' },
        { status: 400 }
      );
    }
    const { getServerApiClient } = await import('@/app/lib/api/server-client');
    const apiClient = await getServerApiClient();
    const response = await apiClient.post(
      `/api/reels-maker/sessions/${sessionId}/auto-captions`
    );
    return NextResponse.json(response.data, { status: response.status });
  } catch (error: unknown) {
    const parsed = error as {
      response?: { status?: number; data?: { message?: string; errorCode?: string } };
    };
    const status = parsed.response?.status || 500;
    return NextResponse.json(
      {
        success: false,
        status,
        message:
          parsed.response?.data?.message || '자동자막 생성을 시작하지 못했습니다.',
        errorCode:
          parsed.response?.data?.errorCode || 'AUTO_CAPTION_START_ERROR',
        data: null,
      },
      { status }
    );
  }
}
