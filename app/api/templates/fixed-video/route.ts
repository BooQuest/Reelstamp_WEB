// 고정 영상 프록시 API: fixed_video_url을 서버에서 가져와 스트리밍
import { NextRequest, NextResponse } from 'next/server';

const DRIVE_HOSTS = ['drive.google.com', 'docs.google.com', 'drive.usercontent.google.com'];

const isDriveHost = (url: URL) =>
  DRIVE_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));

const extractDriveId = (url: URL) => {
  const byQuery = url.searchParams.get('id');
  if (byQuery) return byQuery;
  const fileMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
  if (fileMatch?.[1]) return fileMatch[1];
  return null;
};

const isHtmlResponse = (response: Response) => {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  return contentType.includes('text/html');
};

const extractConfirmToken = (html: string) => {
  const directMatch = html.match(/confirm=([0-9A-Za-z_]+)&/);
  if (directMatch?.[1]) return directMatch[1];
  const inputMatch = html.match(/name="confirm"\s+value="([^"]+)"/);
  return inputMatch?.[1] ?? null;
};

const extractWarningCookieToken = (setCookieHeader: string | null) => {
  if (!setCookieHeader) return null;
  const match = setCookieHeader.match(/download_warning[^=]*=([^;]+)/);
  return match?.[1] ?? null;
};

const buildDriveDownloadUrl = (id: string, confirm?: string) => {
  const url = new URL('https://drive.google.com/uc');
  url.searchParams.set('export', 'download');
  url.searchParams.set('id', id);
  if (confirm) {
    url.searchParams.set('confirm', confirm);
  }
  return url.toString();
};

const fetchDriveFile = async (id: string) => {
  let response = await fetch(buildDriveDownloadUrl(id));
  if (!response.ok) return response;

  if (isHtmlResponse(response)) {
    const html = await response.text();
    const tokenFromHtml = extractConfirmToken(html);
    const tokenFromCookie = extractWarningCookieToken(response.headers.get('set-cookie'));
    const confirmToken = tokenFromHtml || tokenFromCookie;
    if (!confirmToken) {
      return new Response(html, {
        status: 400,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const cookieHeader = response.headers.get('set-cookie') ?? '';
    response = await fetch(buildDriveDownloadUrl(id, confirmToken), {
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    });
  }

  return response;
};

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  const driveId = request.nextUrl.searchParams.get('driveId');
  if (!url && !driveId) {
    return NextResponse.json(
      {
        success: false,
        status: 400,
        message: 'url 또는 driveId 파라미터가 필요합니다.',
        errorCode: 'INVALID_REQUEST',
        data: null,
      },
      { status: 400 }
    );
  }

  let parsedUrl: URL | null = null;
  if (url) {
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
  }

  try {
    const resolvedDriveId =
      driveId ||
      (parsedUrl && isDriveHost(parsedUrl) ? extractDriveId(parsedUrl) : null);

    const upstream = resolvedDriveId
      ? await fetchDriveFile(resolvedDriveId)
      : await fetch(parsedUrl!.toString());

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
    if (contentType.toLowerCase().includes('text/html')) {
      return NextResponse.json(
        {
          success: false,
          status: 400,
          message: '고정 영상 링크가 올바르지 않습니다. 직접 다운로드 링크를 확인해주세요.',
          errorCode: 'FIXED_VIDEO_INVALID_CONTENT',
          data: null,
        },
        { status: 400 }
      );
    }
    const body = upstream.body;

    if (!body) {
      const data = await upstream.arrayBuffer();
      return new NextResponse(data, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'no-store',
        },
      });
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
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
