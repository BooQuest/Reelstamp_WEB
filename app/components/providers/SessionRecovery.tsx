'use client';

import { useEffect, useRef, useState } from 'react';
import type { UserInfo } from '@/app/lib/api/auth';
import { AUTH_CHANGED_EVENT, AUTH_EXPIRED_EVENT, blockAuthenticatedRequests } from '@/app/lib/auth/browser-session';

interface Props {
  user: UserInfo | null;
  onVerified: (user: UserInfo | null) => void;
  onExpired: () => void;
}

export default function SessionRecovery({ user, onVerified, onExpired }: Props) {
  const [expired, setExpired] = useState(false);
  const [message, setMessage] = useState('');
  const [checking, setChecking] = useState(false);
  const expectedUser = useRef<number | null>(null);
  const state = useRef({ user, onVerified, onExpired });
  state.current = { user, onVerified, onExpired };
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Promise<void> | null>(null);

  function expire() {
    if (!state.current.user) return;
    if (window.location.pathname === '/login' || window.location.pathname === '/auth/complete') return;
    expectedUser.current ??= state.current.user.id;
    blockAuthenticatedRequests(true);
    setExpired(true);
    state.current.onExpired();
  }

  async function verify() {
    if (pending.current) return pending.current;
    pending.current = (async () => {
      setChecking(true);
      try {
        const response = await fetch('/api/auth/session', { cache: 'no-store' });
        if (response.status === 401) { expire(); return; }
        if (!response.ok) { setMessage('연결이 원활하지 않습니다. 잠시 후 다시 확인해 주세요.'); return; }
        const { data } = await response.json();
        if (!data?.userInfo?.id) throw new Error('Invalid session response');
        const previousId = expectedUser.current ?? state.current.user?.id;
        if (previousId && data.userInfo.id !== previousId) {
          // A login action may have completed while this earlier read was in flight.
          if (window.location.pathname === '/login' || window.location.pathname === '/auth/complete') return;
          expectedUser.current = previousId;
          state.current.onExpired();
          setMessage('작업을 이어가려면 이전에 사용하던 계정으로 로그인해 주세요.');
          blockAuthenticatedRequests(true);
          setExpired(true);
          return;
        }
        state.current.onVerified(data.userInfo);
        expectedUser.current = null;
        blockAuthenticatedRequests(false);
        setExpired(false);
        setMessage('');
        if (expiryTimer.current) clearTimeout(expiryTimer.current);
        const delay = Date.parse(data.refreshTokenExpiresAt) - Date.now();
        // Absolute expiry is independent of activity; the Backend remains authoritative.
        if (Number.isFinite(delay)) expiryTimer.current = setTimeout(() => { void verify(); }, Math.max(1000, delay + 250));
      } catch { setMessage('연결이 원활하지 않습니다. 잠시 후 다시 확인해 주세요.'); }
      finally { setChecking(false); pending.current = null; }
    })();
    return pending.current;
  }

  useEffect(() => {
    const changed = () => { void verify(); };
    const lost = () => { expire(); };
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('reelstamp-auth') : null;
    if (channel) channel.onmessage = changed;
    window.addEventListener(AUTH_EXPIRED_EVENT, lost);
    window.addEventListener(AUTH_CHANGED_EVENT, changed);
    window.addEventListener('focus', changed);
    void verify();
    return () => {
      channel?.close();
      window.removeEventListener(AUTH_EXPIRED_EVENT, lost);
      window.removeEventListener(AUTH_CHANGED_EVENT, changed);
      window.removeEventListener('focus', changed);
      if (expiryTimer.current) clearTimeout(expiryTimer.current);
      blockAuthenticatedRequests(false);
    };
  // Event handlers use the latest callbacks through state.current; subscribe only once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async () => {
    // Open synchronously from the user's gesture so mobile popup blocking does not lose the editor.
    window.open('/login?returnUrl=%2Fauth%2Fcomplete', '_blank', 'noopener,noreferrer');
  };

  if (!expired) return message ? <div role="status" className="fixed bottom-3 left-1/2 z-40 -translate-x-1/2 rounded-xl bg-slate-900 p-4 text-sm text-white">{message}<button className="ml-2 underline" onClick={() => void verify()}>다시 확인</button></div> : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-5" role="dialog" aria-modal="true" aria-labelledby="reauth-title">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 id="reauth-title" className="text-lg font-bold">다시 로그인해 주세요</h2>
        <p className="mt-3 text-sm text-gray-600">
          로그인이 만료되었거나 종료됐어요.
          {user && !user.guest && user.provider !== 'GUEST' && ' 이 창을 그대로 두고 새 탭에서 같은 계정으로 로그인하면 작업을 이어갈 수 있어요.'}
        </p>
        {message && <p role="status" className="mt-3 text-sm text-red-600">{message}</p>}
        <button onClick={login} className="mt-5 w-full rounded-xl bg-gray-900 p-3 font-semibold text-white">새 탭에서 로그인</button>
        <button onClick={() => void verify()} disabled={checking} className="mt-2 w-full rounded-xl border p-3 text-sm">{checking ? '확인 중...' : '로그인 완료 확인'}</button>
        <p className="mt-3 text-xs text-gray-500">이 창을 닫거나 새로고침하면 저장되지 않은 작업은 복구되지 않을 수 있어요.</p>
      </div>
    </div>
  );
}
