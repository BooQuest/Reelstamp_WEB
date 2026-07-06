import { NextRequest, NextResponse } from 'next/server';

const parseApiError = (error: unknown) => {
  const parsed = error as {
    response?: { status?: number; data?: { message?: string; errorCode?: string } };
  };
  return parsed.response;
};

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId?: string }> }
) {
  try {
    const { sessionId } = await params;
    if (!sessionId) {
      return NextResponse.json({ success: false, message: 'sessionId가 필요합니다.' }, { status: 400 });
    }
    const body = await request.json();
    const { getServerApiClient } = await import('@/app/lib/api/server-client');
    const apiClient = await getServerApiClient();
    const response = await apiClient.put(`/api/reels-maker/sessions/${sessionId}/draft`, body);
    return NextResponse.json(response.data, { status: response.status });
  } catch (error: unknown) {
    const apiError = parseApiError(error);
    const status = apiError?.status || 500;
    return NextResponse.json(
      {
        success: false,
        status,
        message: apiError?.data?.message || '프로젝트 저장에 실패했습니다.',
        errorCode: apiError?.data?.errorCode || 'REELS_MAKER_DRAFT_SAVE_ERROR',
        data: null,
      },
      { status }
    );
  }
}
