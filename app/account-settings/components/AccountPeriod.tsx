import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import type { EntitlementSummary } from '@/app/lib/coupons/types';
import { couponDate, couponTime } from '@/app/lib/coupons/display';

export default function AccountPeriod({ summary, onRetry }: {
  summary: EntitlementSummary | null;
  onRetry: () => void;
}) {
  const expired = summary?.endsAt && Date.parse(summary.endsAt) <= Date.parse(summary.serverNow);
  return (
    <div>
      <span className="text-sm text-gray-500 mb-1 block">이용기간</span>
      <div className="flex items-start gap-3 text-gray-900">
        <CalendarDays className="w-5 h-5 shrink-0 text-gray-400" />
        <div>
          {!summary ? (
            <p role="alert" className="text-sm text-gray-600">
              이용기간을 불러오지 못했습니다.{' '}
              <button type="button" onClick={onRetry} className="underline text-rose-600">다시 확인</button>
            </p>
          ) : summary.endsAt ? (
            <>
              <p>{couponDate(summary.endsAt)}까지{expired ? ' · 기간 만료' : ''}</p>
              <p className="mt-1 text-xs text-gray-500">{couponTime(summary.endsAt)} 만료 (한국 시간)</p>
              <Link href="/plan" className="mt-1 inline-block text-xs text-rose-600 underline">이용권 정보 확인</Link>
            </>
          ) : <p>보유 이용권 없음</p>}
        </div>
      </div>
    </div>
  );
}
