// 가이드 이미지 프록시 API: guide_image_url을 서버에서 가져와 전달
import { NextRequest, NextResponse } from 'next/server';

const isHtmlResponse = (contentType: string | null) =>
  !!contentType && contentType.toLowerCase().includes('text/html');

const extractDriveConfirmToken = (html: string) => {
  const match =
    html.match(/confirm=([0-9A-Za-z_]+)/) ||
    html.match(/name="confirm"\s+value="([^"]+)"/) ||
    html.match(/\"confirm\"\s*:\s*\"([0-9A-Za-z_]+)\"/);
  return match ? match[1] : null;
};

const extractDriveFileId = (url: URL, html?: string) => {
  const id = url.searchParams.get('id');
  if (id) return id;
  if (!html) return null;
  const match = html.match(/id=([0-9A-Za-z_-]{10,})/);
  return match ? match[1] : null;
};

const getDriveCookieHeader = (response: Response) => {
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) return null;
  return setCookie
    .split(',')
    .map((part) => part.split(';')[0]?.trim())
    .filter(Boolean)
    .join('; ');
};

const fetchGoogleDriveAsset = async (url: string) => {
  const initial = await fetch(url, {
    redirect: 'follow',
    headers: {
      Accept: 'image/*,*/*;q=0.8',
    },
  });

  const initialType = initial.headers.get('content-type');
  if (initial.ok && !isHtmlResponse(initialType)) {
    return initial;
  }

  const html = await initial.text();
  const confirm = extractDriveConfirmToken(html);
  const parsedUrl = new URL(url);
  const id = extractDriveFileId(parsedUrl, html);
  if (!confirm || !id) {
    return new Response(html, {
      status: initial.status,
      headers: initial.headers,
    });
  }

  const cookie = getDriveCookieHeader(initial);
  const confirmedUrl = new URL('https://drive.google.com/uc');
  confirmedUrl.searchParams.set('export', 'download');
  confirmedUrl.searchParams.set('id', id);
  confirmedUrl.searchParams.set('confirm', confirm);

  const confirmed = await fetch(confirmedUrl.toString(), {
    redirect: 'follow',
    headers: {
      ...(cookie ? { cookie } : {}),
      Accept: 'image/*,*/*;q=0.8',
    },
  });

  return confirmed;
};

export async function GET(request: NextRequest) {
  const driveId = request.nextUrl.searchParams.get('driveId');
  const rawUrl = request.nextUrl.searchParams.get('url');
  const url = driveId
    ? `https://drive.google.com/uc?export=view&id=${encodeURIComponent(driveId)}`
    : rawUrl;
  if (!url) {
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
    const upstream =
      parsedUrl.hostname.includes('drive.google.com') ||
      parsedUrl.hostname.includes('docs.google.com')
        ? await fetchGoogleDriveAsset(parsedUrl.toString())
        : await fetch(parsedUrl.toString());
    if (!upstream.ok) {
      return NextResponse.json(
        {
          success: false,
          status: upstream.status,
          message: '가이드 이미지를 가져오지 못했습니다.',
          errorCode: 'GUIDE_IMAGE_FETCH_ERROR',
          data: null,
        },
        { status: upstream.status }
      );
    }

    const contentType = upstream.headers.get('content-type') || 'image/png';
    if (isHtmlResponse(contentType)) {
      return NextResponse.json(
        {
          success: false,
          status: 400,
          message: '가이드 이미지 링크가 올바르지 않습니다. 직접 다운로드 링크를 확인해주세요.',
          errorCode: 'GUIDE_IMAGE_HTML_RESPONSE',
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
        message: error?.message || '가이드 이미지를 가져오는 중 오류가 발생했습니다.',
        errorCode: 'GUIDE_IMAGE_PROXY_ERROR',
        data: null,
      },
      { status: 500 }
    );
  }
}
