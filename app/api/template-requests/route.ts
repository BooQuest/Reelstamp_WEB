// 템플릿 요청 API Route: Spring API의 /api/template-requests를 프록시
import { NextRequest, NextResponse } from 'next/server';

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

export async function POST(request: NextRequest) {
  try {
    const { getServerApiClient } = await import('@/app/lib/api/server-client');
    const apiClient = await getServerApiClient();
    const body = await request.json();

    const response = await apiClient.post('/api/template-requests', body);

    return NextResponse.json(response.data, {
      status: response.status,
    });
  } catch (error: unknown) {
    const apiError = toApiClientError(error);
    console.error('[TemplateRequest API Error]', {
      message: apiError.message,
      status: apiError.response?.status,
      data: apiError.response?.data,
    });

    const status = apiError.response?.status || 500;
    const message =
      apiError.response?.data?.message || '템플릿 요청 처리 중 오류가 발생했습니다.';

    return NextResponse.json(
      {
        success: false,
        status,
        message,
        errorCode: apiError.response?.data?.errorCode || 'TEMPLATE_REQUEST_ERROR',
        data: null,
      },
      { status }
    );
  }
}
