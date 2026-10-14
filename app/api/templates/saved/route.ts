import { localisedApiError } from '@/app/i18n/api-error';
import { templateLocale } from '@/app/i18n/api-locale';
// 저장된 릴스 템플릿 목록 조회 API Route: Spring API의 /api/templates/saved를 프록시
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const locale = await templateLocale(request);
    const { getMutableServerApiClient } = await import('@/app/lib/api/server-client');
    const apiClient = await getMutableServerApiClient();

    const response = await apiClient.get(`/api/templates/saved?locale=${locale}`);

    return NextResponse.json(response.data, {
      status: response.status,
    });
  } catch (error: unknown) {
    return localisedApiError(error, '저장된 템플릿을 가져오는 중 오류가 발생했습니다.', 'SAVED_TEMPLATES_ERROR');
  }
}
