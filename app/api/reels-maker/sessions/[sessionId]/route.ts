// 릴스 제작 세션 상세 조회 API Route: Spring API의 /api/reels-maker/sessions/{id}를 프록시
import { NextRequest, NextResponse } from 'next/server';

async function resolveSessionId(
  request: NextRequest,
  params: { sessionId?: string } | Promise<{ sessionId?: string }>
) {
  const resolvedParams = await Promise.resolve(params);
  return resolvedParams?.sessionId || request.nextUrl.pathname.split('/').pop();
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

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId?: string } | Promise<{ sessionId?: string }> }
) {
  try {
    const { getServerApiClient } = await import('@/app/lib/api/server-client');
    const apiClient = await getServerApiClient();

    const rawSessionId = await resolveSessionId(request, params);
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

    const response = await apiClient.get(`/api/reels-maker/sessions/${rawSessionId}`);

    return NextResponse.json(response.data, {
      status: response.status,
    });
  } catch (error: unknown) {
    const apiError = parseApiError(error);
    console.error('[ReelsMakerSession API Error]', {
      message: apiError.message,
      status: apiError.status,
      data: apiError.data,
    });

    const status = apiError.status || 500;
    const message = apiError.data?.message || '릴스 제작 세션을 가져오는 중 오류가 발생했습니다.';

    return NextResponse.json(
      {
        success: false,
        status,
        message,
        errorCode: apiError.data?.errorCode || 'REELS_MAKER_SESSION_ERROR',
        data: null,
      },
      { status }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { sessionId?: string } | Promise<{ sessionId?: string }> }
) {
  try {
    const { getServerApiClient } = await import('@/app/lib/api/server-client');
    const apiClient = await getServerApiClient();

    const rawSessionId = await resolveSessionId(request, params);
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

    const response = await apiClient.delete(`/api/reels-maker/sessions/${rawSessionId}`);

    return NextResponse.json(response.data, {
      status: response.status,
    });
  } catch (error: unknown) {
    const apiError = parseApiError(error);
    console.error('[ReelsMakerSessionDelete API Error]', {
      message: apiError.message,
      status: apiError.status,
      data: apiError.data,
    });

    const status = apiError.status || 500;
    const message = apiError.data?.message || '릴스 삭제 중 오류가 발생했습니다.';

    return NextResponse.json(
      {
        success: false,
        status,
        message,
        errorCode: apiError.data?.errorCode || 'REELS_MAKER_SESSION_DELETE_ERROR',
        data: null,
      },
      { status }
    );
  }
}
