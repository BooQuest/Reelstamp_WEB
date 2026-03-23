// 릴스 템플릿 상세 조회 API Route: Spring API의 /api/templates/{id}를 프록시
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { templateId?: string } | Promise<{ templateId?: string }> }
) {
  try {
    const { getServerApiClient } = await import('@/app/lib/api/server-client');
    const apiClient = await getServerApiClient();

    const resolvedParams = await Promise.resolve(params);
    const rawTemplateId =
      resolvedParams?.templateId || request.nextUrl.pathname.split('/').pop();
    if (!rawTemplateId) {
      return NextResponse.json(
        {
          success: false,
          status: 400,
          message: 'templateId가 필요합니다.',
          errorCode: 'INVALID_REQUEST',
          data: null,
        },
        { status: 400 }
      );
    }

    const templateId = encodeURIComponent(rawTemplateId);
    const response = await apiClient.get(`/api/templates/${templateId}`);

    return NextResponse.json(response.data, {
      status: response.status,
    });
  } catch (error: any) {
    console.error('[TemplateDetail API Error]', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });

    const status = error.response?.status || 500;
    const message =
      error.response?.data?.message || '템플릿 정보를 가져오는 중 오류가 발생했습니다.';

    return NextResponse.json(
      {
        success: false,
        status,
        message,
        errorCode: error.response?.data?.errorCode || 'TEMPLATE_DETAIL_ERROR',
        data: null,
      },
      { status }
    );
  }
}
