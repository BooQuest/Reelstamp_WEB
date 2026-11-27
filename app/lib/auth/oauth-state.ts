import 'server-only';
import { cookies } from 'next/headers';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { AuthRequestError } from './server-errors';
import { requireSameOrigin } from './route-helpers';

export const OAUTH_STATE_COOKIE = 'reelstamp-oauth-state';
const GOOGLE_STATE_PREFIX = /^GOOGLE:([A-Za-z0-9_-]{43}):/;

export function createGoogleOAuthNonce() {
  const nonce = randomBytes(32);
  // Backend reads the first four bytes of the signed nonce as its issuance time.
  nonce.writeUInt32BE(Math.floor(Date.now() / 1000), 0);
  return nonce.toString('base64url');
}

export async function validateOAuthExchange(request: NextRequest, provider: string, state: unknown, redirectUri?: unknown) {
  requireSameOrigin(request);
  const store = await cookies();
  const stored = store.get(OAUTH_STATE_COOKIE)?.value ?? '';
  const googleState = provider === 'GOOGLE' ? GOOGLE_STATE_PREFIX.exec(stored) : null;
  if (provider === 'GOOGLE' && !googleState) {
    throw new AuthRequestError(403, 'FORBIDDEN', 'Google 로그인을 다시 시작해 주세요.');
  }
  const expected = googleState ? `GOOGLE:${stored.slice(googleState[0].length)}` : stored;
  const supplied = `${provider}:${typeof state === 'string' ? state : ''}`;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  if (!expected || typeof state !== 'string' || !state || expectedBytes.length !== suppliedBytes.length ||
      !timingSafeEqual(expectedBytes, suppliedBytes)) {
    throw new AuthRequestError(403, 'FORBIDDEN', 'OAuth state 검증에 실패했습니다.');
  }
  const origin = request.headers.get('origin')!;
  if (redirectUri !== undefined && redirectUri !== `${origin}/login`) {
    throw new AuthRequestError(400, 'INVALID_REQUEST', '허용되지 않은 복귀 주소입니다.');
  }
  store.delete(OAUTH_STATE_COOKIE);
  return googleState?.[1];
}
