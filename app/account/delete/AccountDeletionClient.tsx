'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/components/providers/AuthProvider';
import { useUiText } from '@/app/i18n/LocaleProvider';
import { buildLoginReturnHref } from '@/app/lib/auth/loginRedirect';
import { deleteAccountAction, getDeletionPreviewAction, startDeletionReauthenticationAction } from '@/app/actions/account-deletion';
import { clearDeletedAccountBrowserState, clearDeletionFlow, rememberDeletionConfirmation, resumeDeletion, navigateAfterAccountDeletion, navigateToDeletionProvider } from '@/app/lib/account-deletion/browser';
import { deletionErrorMessage, type DeletionErrorCode, type DeletionPreview, type DeletionResult } from '@/app/lib/account-deletion/types';

export default function AccountDeletionClient() {
  const t = useUiText();
  const { user, isAuthenticated, completeAccountDeletion } = useAuth();
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<DeletionPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<DeletionErrorCode | null>(null);
  const initializedUser = useRef<number | null>(null);
  const executing = useRef(false);
  const currentUserId = useRef(user?.id);
  currentUserId.current = user?.id;

  async function finish(result: DeletionResult) {
    if (result.success) {
      completeAccountDeletion();
      await queryClient.cancelQueries();
      queryClient.clear();
      clearDeletedAccountBrowserState();
      // A full navigation discards the Router cache and all editor memory.
      navigateAfterAccountDeletion();
    } else {
      setError(result.errorCode);
      setBusy(false);
      setConfirmed(false);
      executing.current = false;
    }
  }

  async function loadPreview(userId: number) {
    setLoading(true);
    const result = await getDeletionPreviewAction(userId).catch(() =>
      ({ success: false, errorCode: 'RS-ACC-003' } as const));
    if (currentUserId.current !== userId) return;
    if (result.success) setPreview(result.data);
    else setError(result.errorCode);
    setLoading(false);
  }

  useEffect(() => {
    if (!user || !isAuthenticated || initializedUser.current === user.id) return;
    initializedUser.current = user.id;
    setPreview(null);
    setConfirmed(false);
    setError(null);
    if (new URLSearchParams(window.location.search).has('reauthError')) {
      window.history.replaceState({}, '', '/account/delete');
      clearDeletionFlow();
      setError('RS-ACC-001');
    } else {
      const pending = resumeDeletion(user.id, proof => deleteAccountAction(user.id, proof));
      if (pending) {
        executing.current = true;
        setBusy(true);
        setLoading(false);
        void pending.then(async result => {
          await finish(result);
          if (!result.success) await loadPreview(user.id);
        });
        return;
      }
    }
    void loadPreview(user.id);
  // Deliberately initialize once per account: context rerenders must not repeat DELETE.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isAuthenticated]);

  async function confirmDeletion() {
    if (!user || !isAuthenticated || !confirmed || !preview || executing.current) return;
    executing.current = true;
    setBusy(true);
    setError(null);
    try {
      clearDeletionFlow();
      if (user.provider === 'NAVER' || user.provider === 'GOOGLE') {
        const result = await startDeletionReauthenticationAction(user.id);
        if (!result.success) { await finish(result); return; }
        rememberDeletionConfirmation(user.id, result.data);
        navigateToDeletionProvider(result.data.authorizationUrl);
      } else {
        await finish(await deleteAccountAction(user.id));
      }
    } catch { await finish({ success: false, errorCode: 'RS-ACC-003' }); }
  }

  const date = (value: string) => new Intl.DateTimeFormat(t.locale === 'en' ? 'en-GB' : 'ko-KR',
    { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
  const passes = [...(preview?.active ?? []), ...(preview?.scheduled ?? [])];
  const button = user?.provider === 'KAKAO' ? '카카오 연결 해제 후 탈퇴'
    : user?.provider === 'NAVER' ? '네이버 연결 해제 후 탈퇴'
    : user?.provider === 'GOOGLE' ? '구글 연결 해제 후 탈퇴'
    : user?.provider === 'APPLE' ? 'Apple 연결 해제 후 탈퇴' : '탈퇴하기';

  return <div className="min-h-[calc(100vh-80px)] bg-gradient-to-b from-pink-50 to-white px-4 py-10 sm:py-16">
    <section className="mx-auto max-w-xl space-y-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8" aria-labelledby="deletion-title" aria-busy={busy}>
      <h1 id="deletion-title" className="text-2xl font-bold text-gray-900">{t('회원 탈퇴')}</h1>
      <p className="text-sm text-gray-600">{t('탈퇴 전에 삭제되는 정보와 보존되는 기록을 확인해 주세요.')}</p>
      <div className="space-y-2 text-sm leading-6 text-gray-700">
        <p>{t('회원정보, 저장한 프로젝트·영상·이미지·자막, 즐겨찾기가 삭제됩니다.')}</p>
        <p>{t('결제·환불 등 법령상 보존이 필요한 기록은 안내된 기간 동안 분리 보관됩니다.')}</p>
        <Link href="/privacy-policy" className="inline-block underline underline-offset-4">{t('개인정보처리방침 및 보존 기간 확인')}</Link>
      </div>
      {!isAuthenticated || !user ? <div className="space-y-4">
        <p className="text-sm text-gray-600">{t('탈퇴할 계정으로 로그인해 주세요. 로그인 후 이 페이지로 돌아옵니다.')}</p>
        <Link href={buildLoginReturnHref('/account/delete')} className="block rounded-xl bg-gray-900 p-3 text-center font-semibold text-white">{t('로그인')}</Link>
      </div> : <>
        {busy ? <p role="status" className="rounded-xl bg-gray-50 p-4 text-sm">{t('탈퇴 요청을 처리하고 있습니다. 잠시 기다려 주세요.')}</p> : <>
          {loading ? <p role="status">{t('이용권 정보를 확인하고 있습니다...')}</p> : preview && <div className="space-y-4">
            {passes.length > 0 && <div className="rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              <p>{t.format('남은 이용권이 있습니다. 만료일: {expiresAt}.', { expiresAt: date(passes.reduce((latest, pass) => Date.parse(pass.expiresAt) > Date.parse(latest) ? pass.expiresAt : latest, passes[0].expiresAt)) })}</p>
              <p>{t('탈퇴 시 남은 이용권은 소멸합니다. 환불을 원하시면 탈퇴 전에 고객센터로 요청해 주세요.')}</p>
            </div>}
            {(['active', 'scheduled'] as const).map(group => preview[group].length > 0 && <div key={group}>
              <h2 className="mb-2 text-sm font-semibold">{t(group === 'active' ? '사용 중인 이용권' : '시작 예정 이용권')}</h2>
              <ul className="space-y-3">{preview[group].map((pass, index) => <li key={`${group}-${index}`} className="rounded-xl border border-gray-200 p-4 text-sm">
                <p className="font-semibold">{pass.productName}</p>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-gray-600">
                  <dt>{t('종류')}</dt><dd>{t(pass.type === 'COUPON' ? '쿠폰' : pass.type === 'LEGACY' ? '기존 구독' : '기간제 이용권')}</dd>
                  <dt>{t('결제일')}</dt><dd>{pass.paidAt ? date(pass.paidAt) : '—'}</dd>
                  <dt>{t('만료일')}</dt><dd>{date(pass.expiresAt)}</dd>
                  <dt>{t('결제금액')}</dt><dd>{pass.amount === null ? '—' : new Intl.NumberFormat(t.locale === 'en' ? 'en-US' : 'ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(pass.amount)}</dd>
                </dl>
              </li>)}</ul>
            </div>)}
            {passes.length === 0 && <p className="text-sm text-gray-600">{t('남은 이용권이 없습니다.')}</p>}
          </div>}
          {!preview && !loading && <button type="button" onClick={() => void loadPreview(user.id)} className="text-sm underline">{t('다시 확인')}</button>}
          <label className="flex items-start gap-3 text-sm leading-6">
            <input type="checkbox" checked={confirmed} disabled={!preview || loading} onChange={event => setConfirmed(event.target.checked)} className="mt-1 h-4 w-4 accent-rose-600" />
            <span>{t('삭제·보존 범위와 이용권 안내를 확인했으며 회원 탈퇴에 동의합니다.')}</span>
          </label>
          <button type="button" onClick={() => void confirmDeletion()} disabled={!confirmed || !preview || loading}
            className="w-full rounded-xl bg-[#8B2635] p-3 font-semibold text-white transition-colors hover:bg-[#6B1A25] disabled:cursor-not-allowed disabled:opacity-40">{t(button)}</button>
        </>}
        {error && <p role="alert" className="text-sm leading-6 text-red-700">{t(deletionErrorMessage(error))}</p>}
      </>}
    </section>
  </div>;
}
