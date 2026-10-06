import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { AuthRequestError, errorStatus } from './server-errors';

export function requireSameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  const allowed = new Set([request.nextUrl.origin]);
  // Next may normalize nextUrl to localhost; use the request Host for the browser-facing origin.
  const host = request.headers.get('host');
  if (host) allowed.add(new URL(`${request.nextUrl.protocol}//${host}`).origin);
  if (process.env.NEXT_PUBLIC_BASE_URL) allowed.add(new URL(process.env.NEXT_PUBLIC_BASE_URL).origin);
  if (!origin || !allowed.has(origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new AuthRequestError(403, 'FORBIDDEN', '허용되지 않은 요청입니다.');
  }
}
export function authRouteError(error: unknown) {
  const status = errorStatus(error);
  const safeStatus = status && [400, 401, 403, 404, 429].includes(status) ? status : 503;
  return NextResponse.json({ success: false, status: safeStatus,
    message: safeStatus === 401 ? '로그인이 만료되었습니다. 다시 로그인해 주세요.' : '요청을 처리하지 못했습니다. 다시 시도해 주세요.',
    errorCode: safeStatus === 401 ? 'INVALID_TOKEN' : safeStatus === 403 ? 'FORBIDDEN' : 'AUTH_REQUEST_FAILED', data: null,
  }, { status: safeStatus, headers: { 'Cache-Control': 'no-store' } });
}
export const authJson = (value: unknown) => NextResponse.json(value, { headers: { 'Cache-Control': 'private, no-store' } });
