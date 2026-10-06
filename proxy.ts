import { NextRequest, NextResponse } from 'next/server';
import { refreshTokens } from '@/app/lib/auth/refresh';
import { clearTokenCookies, saveTokenCookies, shouldRefreshAccessToken } from '@/app/lib/auth/token-cookies';
import { requireSameOrigin, authRouteError } from '@/app/lib/auth/route-helpers';
import { errorStatus } from '@/app/lib/auth/server-errors';

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
        (request.cookies.has('accessToken') || request.cookies.has('refreshToken'))) {
      try { requireSameOrigin(request); } catch (error) { return authRouteError(error); }
    }
    return NextResponse.next();
  }
  // Route Handlers / Server Actions own their response cookies. No rotation on logout or callbacks.
  if (!['GET', 'HEAD'].includes(request.method) || request.headers.has('next-action')) return NextResponse.next();
  const refreshToken = request.cookies.get('refreshToken')?.value;
  if (!refreshToken || !shouldRefreshAccessToken(request.cookies.get('accessToken')?.value)) return NextResponse.next();
  try {
    const info = await refreshTokens(refreshToken);
    request.cookies.set('accessToken', info.accessToken);
    request.cookies.set('refreshToken', info.refreshToken);
    const headers = new Headers(request.headers);
    headers.set('cookie', request.cookies.toString());
    const response = NextResponse.next({ request: { headers } });
    saveTokenCookies(response.cookies, info);
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } catch (error) {
    if (errorStatus(error) !== 401) {
      // Preserve credentials; rendering will present a retryable error, not log the user out.
      return new NextResponse('로그인 서버에 연결하지 못했습니다. 잠시 후 새로고침해 주세요.', {
        status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '5' },
      });
    }
    request.cookies.delete('accessToken');
    request.cookies.delete('refreshToken');
    const headers = new Headers(request.headers);
    headers.set('cookie', request.cookies.toString());
    const response = NextResponse.next({ request: { headers } });
    clearTokenCookies(response.cookies);
    return response;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/|fonts/|robots.txt|sitemap.xml).*)'],
};
