'use client';

import { useEffect, useState } from 'react';
import { notifyAuthChanged } from '@/app/lib/auth/browser-session';

type Session = { sessionId: string; userAgent: string | null; authenticatedAt: string | null;
  lastSeenAt: string; expiresAt: string; current: boolean };
function browserLabel(agent: string | null) {
  const ua = agent || '';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /Chrome|CriOS/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : '알 수 없는 브라우저';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return [browser, os].filter(Boolean).join(' · ');
}
const date = (value: string | null) => value ? new Date(value).toLocaleString('ko-KR') : '이전 로그인';

export default function LoginSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() {
    try {
      const response = await fetch('/api/auth/sessions', { cache: 'no-store' });
      if (!response.ok) throw new Error();
      const result = await response.json();
      setSessions(result.data); setError('');
    } catch { setError('로그인 목록을 불러오지 못했습니다. 다시 시도해 주세요.'); }
  }
  useEffect(() => { void load(); }, []);
  async function revoke(session?: Session) {
    if (!window.confirm(session ? '이 브라우저에서 로그아웃할까요?' : '현재 브라우저를 포함한 모든 브라우저에서 로그아웃할까요?')) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(session ? `/api/auth/sessions/${session.sessionId}` : '/api/auth/logout-all', { method: session ? 'DELETE' : 'POST' });
      if (!response.ok) throw new Error();
      notifyAuthChanged();
      if (!session || session.current) window.location.assign('/login');
      else await load();
    } catch { setError('로그아웃을 완료하지 못했습니다. 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  }
  return <section className="mb-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
    <h2 className="text-lg font-bold">로그인된 브라우저</h2>
    <p className="mt-2 text-xs text-gray-500">각 브라우저의 최초 로그인부터 최대 14일간 유지됩니다.</p>
    {error && <p role="alert" className="mt-3 text-sm text-red-600">{error} <button onClick={() => void load()} className="underline">다시 시도</button></p>}
    <ul className="divide-y">{sessions.map(session => <li key={session.sessionId} className="py-4">
      <div className="text-sm font-semibold">{browserLabel(session.userAgent)} {session.current && <span className="text-pink-600">현재 브라우저</span>}</div>
      <dl className="mt-2 space-y-1 text-xs text-gray-500">
        <div>로그인: {date(session.authenticatedAt)}</div><div>최근 활동: {date(session.lastSeenAt)}</div><div>만료: {date(session.expiresAt)}</div>
      </dl>
      <button disabled={busy} onClick={() => void revoke(session)} className="mt-2 text-sm underline disabled:opacity-50">로그아웃</button>
    </li>)}</ul>
    <button disabled={busy} onClick={() => void revoke()} className="mt-2 w-full rounded-xl border p-3 text-sm disabled:opacity-50">모든 브라우저에서 로그아웃</button>
  </section>;
}
