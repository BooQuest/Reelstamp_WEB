// 최종 영상 다운로드 프록시: Content-Disposition을 설정해 파일 다운로드로 유도
import { NextRequest, NextResponse } from 'next/server';

const isAllowedHost = (host: string) => {
  if (!host) return false;
  const lower = host.toLowerCase();
  if (!lower.endsWith('.oraclecloud.com')) return false;
  return lower.includes('objectstorage.');
};

const guessExtension = (url: URL, contentType: string | null) => {
  const lowerType = (contentType || '').toLowerCase();
  if (lowerType.includes('webm')) return 'webm';
  if (lowerType.includes('mp4')) return 'mp4';
  const pathname = url.pathname.toLowerCase();
  if (pathname.endsWith('.webm')) return 'webm';
  if (pathname.endsWith('.mp4')) return 'mp4';
  return 'mp4';
};

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get('url');
  if (!rawUrl) {
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
    parsedUrl = new URL(rawUrl);
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

  if (!['http:', 'https:'].includes(parsedUrl.protocol) || !isAllowedHost(parsedUrl.hostname)) {
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
    const upstream = await fetch(parsedUrl.toString(), { cache: 'no-store' });
    if (!upstream.ok) {
      return NextResponse.json(
        {
          success: false,
          status: upstream.status,
          message: '영상을 다운로드하지 못했습니다.',
          errorCode: 'DOWNLOAD_FAILED',
          data: null,
        },
        { status: upstream.status }
      );
    }

    const contentType = upstream.headers.get('content-type') || 'video/mp4';
    const extension = guessExtension(parsedUrl, contentType);
    const filename = `reelstamp-reel.${extension}`;
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    const length = upstream.headers.get('content-length');
    if (length) {
      headers.set('Content-Length', length);
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        status: 500,
        message: error?.message || '영상을 다운로드하는 중 오류가 발생했습니다.',
        errorCode: 'DOWNLOAD_ERROR',
        data: null,
      },
      { status: 500 }
    );
  }
}
