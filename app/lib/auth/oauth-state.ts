import 'server-only';
import { cookies } from 'next/headers';
import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { AuthRequestError } from './server-errors';
import { requireSameOrigin } from './route-helpers';

export const OAUTH_STATE_COOKIE = 'reelstamp-oauth-state';
export async function validateOAuthExchange(request: NextRequest, provider: string, state: unknown, redirectUri?: unknown) {
  requireSameOrigin(request);
  const store = await cookies();
  const expected = store.get(OAUTH_STATE_COOKIE)?.value;
  const supplied = `${provider}:${typeof state === 'string' ? state : ''}`;
  if (!expected || typeof state !== 'string' || !state || expected.length !== supplied.length ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) {
    throw new AuthRequestError(403, 'FORBIDDEN', 'OAuth state 검증에 실패했습니다.');
  }
  const origin = request.headers.get('origin')!;
  if (redirectUri !== undefined && redirectUri !== `${origin}/login`) {
    throw new AuthRequestError(400, 'INVALID_REQUEST', '허용되지 않은 복귀 주소입니다.');
  }
  store.delete(OAUTH_STATE_COOKIE);
}
