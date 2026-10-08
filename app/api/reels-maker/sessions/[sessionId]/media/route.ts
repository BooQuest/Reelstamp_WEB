import { NextRequest, NextResponse } from 'next/server';
import { getMutableServerApiClient } from '@/app/lib/api/server-client';
import { authRouteError } from '@/app/lib/auth/route-helpers';
import type { ReelsMakerSessionResponse } from '@/app/reels-maker/types';

/** Only media belonging to the authenticated session; never accepts a storage URL. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await context.params;
    const assetId = request.nextUrl.searchParams.get('assetId');
    const clipId = request.nextUrl.searchParams.get('clipId');
    if (
      !/^[1-9][0-9]*$/.test(sessionId) ||
      Boolean(assetId) === Boolean(clipId)
    )
      return NextResponse.json(
        { message: '미디어 정보가 필요합니다.' },
        { status: 400 },
      );
    const api = await getMutableServerApiClient();
    const owned = await api.get(`/api/reels-maker/sessions/${sessionId}`);
    const session = owned.data?.data as ReelsMakerSessionResponse;
    const media = assetId
      ? session.mediaAssets?.find((a) => a.id === assetId)
      : session.clips?.find((c) => String(c.clipId) === clipId && !c.fixed);
    if (!media?.downloadUrl)
      return NextResponse.json(
        { message: '영상을 찾을 수 없습니다.' },
        { status: 404 },
      );
    const url = new URL(media.downloadUrl);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      !url.hostname.endsWith('.oraclecloud.com') ||
      !url.hostname.includes('objectstorage.')
    )
      return NextResponse.json(
        { message: '지원되지 않는 미디어 주소입니다.' },
        { status: 502 },
      );
    const range = request.headers.get('range');
    if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range))
      return new NextResponse(null, { status: 416 });
    const upstream = await fetch(url, {
      headers: range ? { Range: range } : {},
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(60000)]),
    });
    if (![200, 206, 416].includes(upstream.status))
      return NextResponse.json(
        { message: '미디어를 불러오지 못했습니다.' },
        { status: 502 },
      );
    const headers = new Headers({
      'Cache-Control': 'private, no-store',
      'Content-Disposition': 'inline',
    });
    for (const name of [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
    ]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    return authRouteError(error);
  }
}
