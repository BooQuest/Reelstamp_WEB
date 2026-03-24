// 고정 영상 프록시 API: fixed_video_url을 서버에서 가져와 스트리밍
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json(
      {
        success: false,
        status: 400,
        message: 'url 파라미터가 필요합니다.',
        errorCode: 'INVALID_REQUEST',
        data: null,
      },
      { status: 400 }
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json(
      {
        success: false,
        status: 400,
        message: '유효하지 않은 URL입니다.',
        errorCode: 'INVALID_URL',
        data: null,
      },
      { status: 400 }
    );
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return NextResponse.json(
      {
        success: false,
        status: 400,
        message: '지원되지 않는 URL입니다.',
        errorCode: 'INVALID_URL',
        data: null,
      },
      { status: 400 }
    );
  }

  try {
    const upstream = await fetch(parsedUrl.toString());
    if (!upstream.ok) {
      return NextResponse.json(
        {
          success: false,
          status: upstream.status,
          message: '고정 영상을 가져오지 못했습니다.',
          errorCode: 'FIXED_VIDEO_FETCH_ERROR',
          data: null,
        },
        { status: upstream.status }
      );
    }

    const contentType = upstream.headers.get('content-type') || 'video/mp4';
    const body = upstream.body;

    if (!body) {
      const data = await upstream.arrayBuffer();
      return new NextResponse(data, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        status: 500,
        message: error?.message || '고정 영상을 가져오는 중 오류가 발생했습니다.',
        errorCode: 'FIXED_VIDEO_PROXY_ERROR',
        data: null,
      },
      { status: 500 }
    );
  }
}
