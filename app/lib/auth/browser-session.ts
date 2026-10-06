'use client';

export const AUTH_EXPIRED_EVENT = 'reelstamp:auth-expired';
export const AUTH_CHANGED_EVENT = 'reelstamp:auth-changed';
let expectedUserId: number | null = null;
export function bindAuthenticatedUser(id: number | null) { expectedUserId = id; }
let requestsBlocked = false;
export function blockAuthenticatedRequests(blocked: boolean) { requestsBlocked = blocked; }

export function notifyAuthChanged() {
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel('reelstamp-auth');
    channel.postMessage('changed');
    channel.close();
  }
}

/** Preserve request semantics; never retry business mutations after an ambiguous failure. */
export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(raw, window.location.origin);
  const privateApi = url.origin === window.location.origin && url.pathname.startsWith('/api/') &&
    !url.pathname.startsWith('/api/auth/');
  if (privateApi && requestsBlocked) {
    return new Response(JSON.stringify({ success: false, status: 401, errorCode: 'INVALID_TOKEN',
      message: '다시 로그인한 뒤 이어서 진행해 주세요.', data: null }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  if (privateApi && expectedUserId) {
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    headers.set('X-Reelstamp-User', String(expectedUserId));
    init = { ...init, headers };
  }
  const response = await fetch(input, init);
  if (privateApi && (response.status === 401 || (response.status === 409 &&
      (await response.clone().json().catch(() => null))?.errorCode === 'AUTH_ACCOUNT_CHANGED'))) {
    blockAuthenticatedRequests(true);
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }
  return response;
}
