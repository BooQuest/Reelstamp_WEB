import { NextRequest, NextResponse } from 'next/server';
import { getMutableServerApiClient } from '@/app/lib/api/server-client';
import { authRouteError } from '@/app/lib/auth/route-helpers';

// The Backend selects the owned result. Never fetch a caller-supplied storage URL.
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('sessionId');
    if (!sessionId || !/^[1-9][0-9]*$/.test(sessionId)) return NextResponse.json({ message: '제작 세션이 필요합니다.' }, { status: 400 });
    const api = await getMutableServerApiClient();
    const owned = await api.get(`/api/reels-maker/sessions/${sessionId}/status`);
    const raw = owned.data?.data?.finalVideoUrl;
    if (!raw) return NextResponse.json({ message: '영상을 찾을 수 없습니다.' }, { status: 404 });
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !url.hostname.endsWith('.oraclecloud.com') || !url.hostname.includes('objectstorage.')) {
      return NextResponse.json({ message: '지원되지 않는 영상 주소입니다.' }, { status: 502 });
    }
    const upstream = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(30000) });
    if (!upstream.ok) return NextResponse.json({ message: '영상을 다운로드하지 못했습니다.' }, { status: 502 });
    const type = upstream.headers.get('content-type') || 'video/mp4';
    const extension = type.includes('webm') || url.pathname.endsWith('.webm') ? 'webm' : 'mp4';
    return new NextResponse(upstream.body, { headers: {
      'Cache-Control': 'private, no-store', 'Content-Type': type,
      'Content-Disposition': `attachment; filename="reelstamp-reel.${extension}"`,
    } });
  } catch (error) { return authRouteError(error); }
}
