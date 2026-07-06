// 릴스 템플릿 카테고리 목록 조회 API Route: Spring API의 /api/templates/categories를 프록시
import { NextResponse } from 'next/server';

type ApiClientError = {
  message?: string;
  response?: {
    status?: number;
    data?: {
      message?: string;
      errorCode?: string;
    };
  };
};

const toApiClientError = (error: unknown): ApiClientError =>
  typeof error === 'object' && error !== null ? (error as ApiClientError) : {};

export async function GET() {
  try {
    const { getServerApiClient } = await import('@/app/lib/api/server-client');
    const apiClient = await getServerApiClient();

    const response = await apiClient.get('/api/templates/categories');

    return NextResponse.json(response.data, {
      status: response.status,
    });
  } catch (error: unknown) {
    const apiError = toApiClientError(error);

    console.error('[TemplateCategories API Error]', {
      message: apiError.message,
      status: apiError.response?.status,
      data: apiError.response?.data,
    });

    const status = apiError.response?.status || 500;
    const message =
      apiError.response?.data?.message || '템플릿 카테고리 목록을 가져오는 중 오류가 발생했습니다.';

    return NextResponse.json(
      {
        success: false,
        status,
        message,
        errorCode: apiError.response?.data?.errorCode || 'TEMPLATE_CATEGORIES_ERROR',
        data: null,
      },
      { status }
    );
  }
}
