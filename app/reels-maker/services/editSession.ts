import { authFetch } from '@/app/lib/auth/browser-session';
import type { ReelsMakerSessionResponse } from '../types';

const HEADER = 'X-Reelstamp-Edit-Token';
const key = (id: string | number) => `reelstamp:edit:${id}`;
const tokens = new Map<string, string>();
const ended = new Set<string>();

function remember(id: string | number, token: string) {
  tokens.set(String(id), token);
  ended.delete(String(id));
  try { sessionStorage.setItem(key(id), token); } catch { /* Memory fallback for restricted storage. */ }
}
function tokenFor(id: string) {
  if (tokens.has(id)) return tokens.get(id);
  try { return sessionStorage.getItem(key(id)); } catch { return null; }
}

/** Only maker requests receive the edit token. Storage uploads never receive this capability. */
export function makerFetch(path: string, init?: RequestInit) {
  const id = path.match(/^\/api\/reels-maker\/sessions\/(\d+)(?:\/|$)/)?.[1];
  if (!id || ['GET', 'HEAD'].includes((init?.method || 'GET').toUpperCase())) return authFetch(path, init);
  if (ended.has(id) && !path.endsWith('/edit/discard') && !path.endsWith('/edit/save'))
    return Promise.reject(new DOMException('This edit has ended', 'AbortError'));
  const token = tokenFor(id);
  if (!token) return authFetch(path, init);
  const headers = new Headers(init?.headers);
  headers.set(HEADER, token);
  return authFetch(path, { ...init, headers });
}

export async function loadEditorSession(templateId: string, requestedId: string | null) {
  if (!requestedId) {
    const token = crypto.randomUUID();
    const response = await authFetch('/api/reels-maker/sessions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', [HEADER]: token },
      body: JSON.stringify({ templateId }),
    });
    const payload = await response.clone().json().catch(() => null);
    if (response.ok && payload?.success && payload.data?.sessionId) remember(payload.data.sessionId, token);
    return response;
  }
  const response = await authFetch(`/api/reels-maker/sessions/${encodeURIComponent(requestedId)}`, { cache: 'no-store' });
  const payload = await response.clone().json().catch(() => null);
  const session = payload?.data as ReelsMakerSessionResponse | undefined;
  if (!response.ok || !payload?.success || !session || !session.draftSavingEnabled
      || session.status === 'PROCESSING' || (session.status === 'COMPLETED' && session.displayStatus !== 'CAPTURE')) return response;
  const token = tokenFor(requestedId) || crypto.randomUUID();
  remember(requestedId, token);
  const opened = await makerFetch(`/api/reels-maker/sessions/${requestedId}/edit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: session.draftVersion }),
  });
  if (opened.status === 409) {
    // Keep the conflict visible. A subsequent explicit reopen can establish a new baseline.
    tokens.delete(requestedId);
    try { sessionStorage.removeItem(key(requestedId)); } catch { /* optional storage */ }
  }
  return opened;
}

export function stopEditorRequests(sessionId: number) { ended.add(String(sessionId)); }
export function resumeEditorRequests(sessionId: number) { ended.delete(String(sessionId)); }

export async function finishEditorSession(sessionId: number, action: 'save' | 'discard', version: number) {
  const response = await makerFetch(`/api/reels-maker/sessions/${sessionId}/edit/${action}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success)
    throw new Error(payload?.message || '작업 종료에 실패했습니다. 다시 시도해 주세요.');
  ended.add(String(sessionId));
  tokens.delete(String(sessionId));
  try { sessionStorage.removeItem(key(sessionId)); } catch { /* optional storage */ }
}

export function releaseEditorSession(sessionId: number) {
  tokens.delete(String(sessionId));
  ended.delete(String(sessionId));
  try { sessionStorage.removeItem(key(sessionId)); } catch { /* optional storage */ }
}
