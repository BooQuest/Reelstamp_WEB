// 저장된 릴스 템플릿 목록 조회 API Route: Spring API의 /api/templates/saved를 프록시
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_request: NextRequest) {
  try {
    const { getServerApiClient } = await import('@/app/lib/api/server-client');
    const apiClient = await getServerApiClient();

    const response = await apiClient.get('/api/templates/saved');

    return NextResponse.json(response.data, {
      status: response.status,
    });
  } catch (error: any) {
    console.error('[SavedTemplates API Error]', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });

    const status = error.response?.status || 500;
    const message =
      error.response?.data?.message || '저장된 템플릿을 가져오는 중 오류가 발생했습니다.';

    return NextResponse.json(
      {
        success: false,
        status,
        message,
        errorCode: error.response?.data?.errorCode || 'SAVED_TEMPLATES_ERROR',
        data: null,
      },
      { status }
    );
  }
}
