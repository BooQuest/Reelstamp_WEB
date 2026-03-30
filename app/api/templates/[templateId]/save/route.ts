// 템플릿 저장 토글 API Route: Spring API의 /api/templates/{id}/save를 프록시
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { templateId?: string } | Promise<{ templateId?: string }> }
) {
  try {
    const { getServerApiClient } = await import('@/app/lib/api/server-client');
    const apiClient = await getServerApiClient();

    const resolvedParams = await Promise.resolve(params);
    const rawTemplateId =
      resolvedParams?.templateId || request.nextUrl.pathname.split('/').at(-2);
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
    const response = await apiClient.post(`/api/templates/${templateId}/save`);

    return NextResponse.json(response.data, {
      status: response.status,
    });
  } catch (error: any) {
    console.error('[TemplateSave API Error]', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });

    const status = error.response?.status || 500;
    const message =
      error.response?.data?.message || '템플릿 저장 처리 중 오류가 발생했습니다.';

    return NextResponse.json(
      {
        success: false,
        status,
        message,
        errorCode: error.response?.data?.errorCode || 'TEMPLATE_SAVE_ERROR',
        data: null,
      },
      { status }
    );
  }
}
