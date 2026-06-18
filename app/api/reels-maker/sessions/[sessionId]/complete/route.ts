// 릴스 제작 완료 API Route: Spring API의 /api/reels-maker/sessions/{id}/complete를 프록시
import { NextRequest, NextResponse } from 'next/server';

const toRecord = (value: unknown): Record<string, unknown> | null =>
  value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const parseApiError = (error: unknown) => {
  const parsed = toRecord(error);
  const response = toRecord(parsed?.response);
  const data = toRecord(response?.data);
  return {
    message: typeof parsed?.message === 'string' ? parsed.message : undefined,
    status: typeof response?.status === 'number' ? response.status : undefined,
    data,
  };
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId?: string }> }
) {
  try {
    const { getServerApiClient } = await import('@/app/lib/api/server-client');
    const apiClient = await getServerApiClient();

    const resolvedParams = await Promise.resolve(params);
    const rawSessionId =
      resolvedParams?.sessionId || request.nextUrl.pathname.split('/').pop();
    if (!rawSessionId) {
      return NextResponse.json(
        {
          success: false,
          status: 400,
          message: 'sessionId가 필요합니다.',
          errorCode: 'INVALID_REQUEST',
          data: null,
        },
        { status: 400 }
      );
    }

    const body = toRecord(await request.json().catch(() => null));
    const captions = Array.isArray(body?.captions) ? body.captions : [];
    const captionItems = Array.isArray(body?.captionItems) ? body.captionItems : [];
    console.info(
      `[CAPTION_TRACE][WEB_PROXY_IN] ${JSON.stringify({
        sessionId: rawSessionId,
        captionCount: captions.length,
        captionItemCount: captionItems.length,
        captionItems: captionItems.map((item) => {
          const record = toRecord(item);
          const placement = toRecord(record?.placement);
          return {
            id: record?.id ?? null,
            clipId: placement?.clipId ?? null,
            textLength: typeof record?.text === 'string' ? record.text.length : null,
            zIndex: record?.zIndex ?? null,
          };
        }),
        captions: captions.map((item) => {
          const record = toRecord(item);
          return {
            clipId: record?.clipId ?? null,
            captionLength:
              typeof record?.caption === 'string' ? record.caption.length : null,
            captionStyle: record?.captionStyle ?? null,
          };
        }),
      })}`
    );

    const response = await apiClient.post(
      `/api/reels-maker/sessions/${rawSessionId}/complete`,
      body ?? undefined
    );

    return NextResponse.json(response.data, {
      status: response.status,
    });
  } catch (error: unknown) {
    const apiError = parseApiError(error);
    console.error('[ReelsMakerComplete API Error]', {
      message: apiError.message,
      status: apiError.status,
      data: apiError.data,
    });

    const status = apiError.status || 500;
    const message =
      (typeof apiError.data?.message === 'string' ? apiError.data.message : undefined) ||
      '릴스 합성을 시작하는 중 오류가 발생했습니다.';

    return NextResponse.json(
      {
        success: false,
        status,
        message,
        errorCode:
          (typeof apiError.data?.errorCode === 'string'
            ? apiError.data.errorCode
            : undefined) || 'REELS_MAKER_COMPLETE_ERROR',
        data: null,
      },
      { status }
    );
  }
}
