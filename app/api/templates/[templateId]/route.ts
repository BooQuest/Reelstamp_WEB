import { localisedApiError } from '@/app/i18n/api-error';
import { templateLocale } from '@/app/i18n/api-locale';
// 릴스 템플릿 상세 조회 API Route: Spring API의 /api/templates/{id}를 프록시
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ templateId?: string }> }
) {
  try {
    const locale = await templateLocale(request);
    const { getMutableServerApiClient } = await import('@/app/lib/api/server-client');
    const apiClient = await getMutableServerApiClient();

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
    const response = await apiClient.get(`/api/templates/${templateId}?locale=${locale}`);

    return NextResponse.json(response.data, {
      status: response.status,
    });
  } catch (error: unknown) {
    return localisedApiError(error, '템플릿 정보를 가져오는 중 오류가 발생했습니다.', 'TEMPLATE_DETAIL_ERROR');
  }
}
