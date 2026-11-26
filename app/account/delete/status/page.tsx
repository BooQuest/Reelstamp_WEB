'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDeletionStatusAction, acknowledgeDeletionAction } from '@/app/actions/deletion-status';
import type { DeletionProgress } from '@/app/lib/account-deletion/types';
import { useUiText } from '@/app/i18n/LocaleProvider';
export default function DeletionStatusPage() {
  const t = useUiText();
  const [status, setStatus] = useState<DeletionProgress | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function refresh() {
    setBusy(true);
    try {
      const result = await getDeletionStatusAction(); setStatus(result);
      setMessage(result ? '' : '조회할 탈퇴 요청이 없거나 조회 기간이 끝났습니다.');
    } catch { setMessage('처리 상태를 확인하지 못했습니다. 탈퇴를 다시 요청하지 말고 잠시 후 확인해 주세요.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { void refresh(); }, []);
  const label = (value: string) => t(({ PENDING: '처리 중', SUCCEEDED: '완료', NOT_APPLICABLE: '처리 대상 없음', ACTION_REQUIRED: '별도 조치 필요' } as Record<string, string>)[value] || value);
  return <main className="mx-auto max-w-xl space-y-5 p-8">
    <h1 className="text-2xl font-bold">{t('탈퇴 처리 상태')}</h1>
    {message && <p role="status">{t(message)}</p>}
    {status && <>
      <p>{t(status.localStatus === 'LOCAL_DELETED' ? '회원정보 삭제가 완료되었습니다.' : status.localStatus === 'REAUTH_REQUIRED' ? '탈퇴 처리를 계속하려면 다시 본인 확인이 필요합니다.' : status.localStatus === 'ACCEPTED_PENDING' ? '탈퇴 요청을 접수했습니다. 회원정보는 아직 삭제되지 않았습니다.' : '탈퇴가 아직 확정되지 않았습니다.')}</p>
      {status.localStatus === 'LOCAL_DELETED' && <ul><li>{t('Apple 연결 정리')}: {label(status.appleStatus)}</li><li>{t('파일 정리')}: {label(status.contentStatus)}</li></ul>}
      {status.complete && <p>{t('전체 정리가 완료되었습니다. 완료 확인 또는 완료 후 24시간에 조회 기록이 삭제됩니다.')}</p>}
      {status.complete && <button disabled={busy} onClick={async () => { setBusy(true); try { await acknowledgeDeletionAction(); setStatus(null); setMessage('완료 확인 후 조회 기록이 삭제되었습니다.'); } catch { setMessage('완료 확인에 실패했습니다. 다시 시도해 주세요.'); } finally { setBusy(false); } }} className="rounded bg-gray-900 px-4 py-2 text-white">{t('완료 확인')}</button>}
    </>}
    <button onClick={() => void refresh()} disabled={busy} className="block underline">{t('상태 새로고침')}</button>
    <Link href="/account/delete" className="block underline">{t('회원 탈퇴')}</Link>
  </main>;
}
