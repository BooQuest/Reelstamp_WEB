import { NextRequest, NextResponse } from 'next/server';

const parseApiError = (error: unknown) => {
  const parsed = error as {
    response?: { status?: number; data?: { message?: string; errorCode?: string } };
  };
  return parsed.response;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId?: string; clipId?: string }> }
) {
  try {
    const { sessionId, clipId } = await params;
    if (!sessionId || !clipId) {
      return NextResponse.json(
        { success: false, message: 'sessionId와 clipId가 필요합니다.' },
        { status: 400 }
      );
    }
    const body = await request.json();
    const { getServerApiClient } = await import('@/app/lib/api/server-client');
    const apiClient = await getServerApiClient();
    const response = await apiClient.post(
      `/api/reels-maker/sessions/${sessionId}/clips/${clipId}/upload-complete`,
      body
    );
    return NextResponse.json(response.data, { status: response.status });
  } catch (error: unknown) {
    const apiError = parseApiError(error);
    const status = apiError?.status || 500;
    return NextResponse.json(
      {
        success: false,
        status,
        message: apiError?.data?.message || '클립 업로드 완료 처리에 실패했습니다.',
        errorCode: apiError?.data?.errorCode || 'REELS_MAKER_UPLOAD_COMPLETE_ERROR',
        data: null,
      },
      { status }
    );
  }
}
