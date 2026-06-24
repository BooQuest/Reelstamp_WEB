import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId?: string; jobId?: string }> }
) {
  try {
    const { sessionId, jobId } = await params;
    if (!sessionId || !jobId) {
      return NextResponse.json(
        { success: false, message: 'sessionId와 jobId가 필요합니다.' },
        { status: 400 }
      );
    }
    const { getServerApiClient } = await import('@/app/lib/api/server-client');
    const apiClient = await getServerApiClient();
    const response = await apiClient.get(
      `/api/reels-maker/sessions/${sessionId}/auto-captions/${encodeURIComponent(jobId)}`
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
          parsed.response?.data?.message || '자동자막 상태를 조회하지 못했습니다.',
        errorCode:
          parsed.response?.data?.errorCode || 'AUTO_CAPTION_STATUS_ERROR',
        data: null,
      },
      { status }
    );
  }
}
