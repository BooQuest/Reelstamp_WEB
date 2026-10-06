import type { TokenInfo } from '@/app/lib/api/auth';

export const AUTH_COOKIE_NAMES = ['accessToken', 'refreshToken'] as const;
type CookieOptions = { httpOnly: boolean; secure: boolean; sameSite: 'lax'; path: string; expires: Date };
export type CookieWriter = {
  set(name: string, value: string, options: CookieOptions): unknown;
  delete(name: string): unknown;
};

export function tokenCookieOptions(expiresAt: string): CookieOptions {
  const expires = new Date(expiresAt);
  if (!Number.isFinite(expires.getTime())) throw new Error('Invalid token expiry');
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', expires };
}

export function saveTokenCookies(store: CookieWriter, info: TokenInfo) {
  store.set('accessToken', info.accessToken, tokenCookieOptions(info.accessTokenExpiresAt));
  store.set('refreshToken', info.refreshToken, tokenCookieOptions(info.refreshTokenExpiresAt));
}

export function clearTokenCookies(store: Pick<CookieWriter, 'delete'>) {
  for (const name of AUTH_COOKIE_NAMES) store.delete(name);
}

// Decoding is only a scheduling hint. Backend verifies signatures, ownership and revocation.
export function shouldRefreshAccessToken(token?: string, now = Date.now()): boolean {
  if (!token) return true;
  try {
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return claims.type !== 'ACCESS' || typeof claims.sid !== 'string' ||
      typeof claims.exp !== 'number' || claims.exp * 1000 <= now + 30_000;
  } catch { return true; }
}
