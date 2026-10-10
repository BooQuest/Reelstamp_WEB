import Link from 'next/link';
import { Crown } from 'lucide-react';
import { formatPassDate, type PassSummary } from '@/app/lib/passes/display';

const STATUS_LABELS: Record<PassSummary['status'], string> = {
  active: '사용 중',
  expired: '기간 만료',
  none: '이용권 없음',
  unknown: '정보 확인 필요',
};

export default function PassSummaryCard({ summary, hideEmpty = false }: { summary: PassSummary; hideEmpty?: boolean }) {
  return (
    <div className="space-y-5">
      {!(hideEmpty && summary.status === 'none') && <section
        aria-label="보유 이용권"
        className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-rose-50 p-3">
            <Crown aria-hidden="true" className="h-6 w-6 text-[#FF496D]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-gray-500">보유 이용권</p>
            <h2 className="mt-1 break-words text-2xl font-bold text-gray-900">{summary.name}</h2>
          </div>
        </div>
        <p className="mt-5 inline-flex rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
          {STATUS_LABELS[summary.status]}
        </p>
        {summary.status === 'none' ? (
          <p className="mt-5 text-sm text-gray-600">보유한 이용권이 없습니다.</p>
        ) : (
          <dl className="mt-6 space-y-4 border-t border-gray-100 pt-6 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-gray-500">이용 시작일</dt>
              <dd>{formatPassDate(summary.startsAt)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-gray-500">이용 종료일</dt>
              <dd>{formatPassDate(summary.endsAt)}</dd>
            </div>
          </dl>
        )}
        {summary.status === 'unknown' && (
          <p className="mt-4 text-sm text-gray-600">
            현재 응답으로는 이용권 정보를 확인할 수 없습니다. 결제 내역을 확인해주세요.
          </p>
        )}
      </section>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/pricing"
          className="rounded-xl bg-[#FF496D] px-5 py-3 text-center font-semibold text-white hover:bg-[#E63E62]"
        >
          이용권 알아보기
        </Link>
        <Link
          href="/plan/payments"
          className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-center font-semibold text-gray-700 hover:bg-gray-50"
        >
          결제 내역 보기
        </Link>
      </div>
    </div>
  );
}
