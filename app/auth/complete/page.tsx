'use client';
import { useState, useEffect } from 'react';
import { logoutAction } from '@/app/actions/auth';
import { notifyAuthChanged } from '@/app/lib/auth/browser-session';
export default function LoginCompletePage() {
  const [error, setError] = useState('');
  async function switchAccount() {
    const result = await logoutAction();
    if (!result.success) { setError(result.message); return; }
    notifyAuthChanged();
    window.location.assign('/login?returnUrl=%2Fauth%2Fcomplete');
  }
  useEffect(() => { notifyAuthChanged(); }, []);
  return <main className="mx-auto max-w-md p-8 text-center">
    <h1 className="text-xl font-bold">로그인을 완료했어요</h1>
    <p className="mt-4">작업하던 탭으로 돌아가 이어서 진행해 주세요.</p>
    {error && <p role="alert">{error}</p>}
    <button onClick={() => void switchAccount()} className="mt-4 block w-full underline">다른 계정으로 다시 로그인</button>
    <a href="/templates" className="mt-6 inline-block underline">릴스탬프 홈으로</a>
  </main>;
}
