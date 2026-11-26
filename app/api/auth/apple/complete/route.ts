import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import type { TokenInfo } from '@/app/lib/api/auth';
import { saveTokenCookies } from '@/app/lib/auth/token-cookies';
import { APPLE_COOKIE, APPLE_HEADERS, appleEnvironment, appleRequest, parseAppleProof } from '@/app/lib/auth/apple';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  // This Route Handler never renders the root layout or analytics. Never log request.url or errors.
  const store = await cookies();
  const { webOrigin } = appleEnvironment();
  let destination = '/login?appleError=1';
  try {
    const proof = parseAppleProof(store.get(APPLE_COOKIE)?.value, request.nextUrl.searchParams.get('transactionId'));
    const code = request.nextUrl.searchParams.get('code');
    if (request.nextUrl.searchParams.has('error') || !code || !/^[A-Za-z0-9_-]{43}$/.test(code)) throw new Error('Apple authentication cancelled');
    const result = await appleRequest<{ tokenInfo: TokenInfo }>('exchange', {
      transactionId: proof.transactionId, code, codeVerifier: proof.verifier,
    });
    saveTokenCookies(store, result.tokenInfo);
    destination = proof.returnUrl;
  } catch { /* Only the fixed, non-sensitive error flag reaches the login page. */ }
  store.set(APPLE_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return NextResponse.redirect(new URL(destination, webOrigin), { status: 303, headers: APPLE_HEADERS });
}
