import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { requireSameOrigin } from '@/app/lib/auth/route-helpers';
import { getGuestCredential } from '@/app/lib/auth/guest-credential';
import { APPLE_COOKIE, APPLE_HEADERS, appleEnvironment, appleRequest, appleWebEnabled, createAppleProof } from '@/app/lib/auth/apple';

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    if (!appleWebEnabled()) return NextResponse.json({ success: false }, { status: 503, headers: APPLE_HEADERS });
    const { webOrigin } = appleEnvironment();
    if (request.headers.get('origin') !== webOrigin) return NextResponse.json({ success: false }, { status: 403, headers: APPLE_HEADERS });
    const body = await request.json();
    const proof = createAppleProof(body.returnUrl);
    const guest = await getGuestCredential();
    const started = await appleRequest<{ transactionId: string; authorizationUrl: string }>('start', {
      platform: 'web', redirectUri: `${webOrigin}/api/auth/apple/complete`, codeChallenge: proof.challenge,
    }, guest);
    const authorization = new URL(started.authorizationUrl);
    if (authorization.origin !== 'https://appleid.apple.com' || authorization.pathname !== '/auth/authorize') throw new Error('Invalid Apple authorization URL');
    (await cookies()).set(APPLE_COOKIE, JSON.stringify({ transactionId: started.transactionId, verifier: proof.verifier,
      expires: Date.now() + 600_000, returnUrl: proof.returnUrl }), {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 600,
    });
    return NextResponse.json({ authorizationUrl: authorization.toString() }, { headers: APPLE_HEADERS });
  } catch {
    return NextResponse.json({ success: false, message: 'Apple login could not be started.' }, { status: 400, headers: APPLE_HEADERS });
  }
}
