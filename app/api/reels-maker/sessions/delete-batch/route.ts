import { NextRequest, NextResponse } from 'next/server';

const MAX_BATCH_DELETE = 100;

function normalizeSessionIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];

  const sanitized = raw
    .map((value) => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    })
    .filter((value): value is number => value !== null)
    .map((value) => Math.trunc(value))
    .filter((value) => value > 0);

  return Array.from(new Set(sanitized));
}

function parseApiError(error: unknown) {
  const parsed = error as {
    message?: string;
    response?: {
      status?: number;
      data?: {
        message?: string;
        errorCode?: string;
      };
    };
  };

  return {
    message: parsed.message,
    status: parsed.response?.status,
    data: parsed.response?.data,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const sessionIds = normalizeSessionIds(body?.sessionIds);

    if (sessionIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          status: 400,
          message: '삭제할 sessionIds가 필요합니다.',
          errorCode: 'INVALID_REQUEST',
          data: {
            results: [],
          },
        },
        { status: 400 }
      );
    }

    if (sessionIds.length > MAX_BATCH_DELETE) {
      return NextResponse.json(
        {
          success: false,
          status: 400,
          message: `한 번에 최대 ${MAX_BATCH_DELETE}개까지 삭제할 수 있습니다.`,
          errorCode: 'BATCH_LIMIT_EXCEEDED',
          data: {
            results: [],
          },
        },
        { status: 400 }
      );
    }

    const { getServerApiClient } = await import('@/app/lib/api/server-client');
    const apiClient = await getServerApiClient();

    const response = await apiClient.post('/api/reels-maker/sessions/delete-batch', {
      sessionIds,
    });

    return NextResponse.json(response.data, {
      status: response.status,
    });
  } catch (error: unknown) {
    const apiError = parseApiError(error);
    console.error('[ReelsMakerSessionBatchDelete API Error]', {
      message: apiError.message,
      status: apiError.status,
      data: apiError.data,
    });

    const status = apiError.status || 500;
    const message = apiError.data?.message || '릴스 일괄 삭제 중 오류가 발생했습니다.';

    return NextResponse.json(
      {
        success: false,
        status,
        message,
        errorCode: apiError.data?.errorCode || 'REELS_MAKER_SESSION_BATCH_DELETE_ERROR',
        data: {
          results: [],
        },
      },
      { status }
    );
  }
}
