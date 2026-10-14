'use client';

import { useUiText } from '@/app/i18n/LocaleProvider';
import Link from 'next/link';
import { ReceiptText } from 'lucide-react';
import { formatPassDate, formatWon, type PaymentRecord } from '@/app/lib/passes/display';

const STATUS_LABELS: Record<PaymentRecord['status'], string> = {
  paid: '결제 완료',
  refunded: '전액 환불',
  partial_refund: '부분 환불 · 확인 필요',
  waiting_deposit: '입금 대기',
  pending: '결제 대기',
  failed: '결제 실패',
  canceled: '결제 취소',
  unknown: '상태 확인 필요',
};

export default function PaymentHistory({ payments }: { payments: PaymentRecord[] }) {
  const t = useUiText();
  if (!payments.length)
    return (
      <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center">
        <ReceiptText aria-hidden="true" className="mx-auto mb-5 h-10 w-10 text-gray-300" />
        <h2 className="text-lg font-semibold text-gray-900">{t("아직 결제 내역이 없습니다.")}</h2>
        <p className="mt-2 text-sm text-gray-500">
          {t("이용권을 구매하면 이곳에서 확인하실 수 있습니다.")}</p>
        <Link href="/pricing" className="mt-6 inline-block font-semibold text-[#D93256]">
          {t("이용권 알아보기")}</Link>
      </div>
    );
  return (
    <ul className="space-y-4" aria-label={t("결제 내역 목록")}>
      {payments.map((payment) => (
        <li key={payment.id} className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="text-lg font-bold text-gray-900">{t(payment.name)}</h2>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${payment.status === 'paid' ? 'bg-rose-50 text-[#D93256]' : 'bg-gray-100 text-gray-600'}`}
            >
              {t(STATUS_LABELS[payment.status])}
            </span>
          </div>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">{t("결제금액")}</dt>
              <dd className="font-semibold text-gray-900">{t(formatWon(payment.amount))}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-gray-500">{t("결제일")}</dt>
              <dd className="text-gray-700">{t(formatPassDate(payment.paidAt))}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-gray-500">{t("주문번호")}</dt>
              <dd className="min-w-0 break-all text-right text-gray-600">
                {t(payment.orderId ?? '주문번호 확인 필요')}
              </dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}
