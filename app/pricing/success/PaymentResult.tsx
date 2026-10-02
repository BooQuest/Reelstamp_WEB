'use client';
import { useEffect, useEffectEvent, useState } from 'react';
import { useAuth } from '@/app/components/providers/AuthProvider';
import Link from 'next/link';
import { ORDER_STATUS, type PassOrder } from '@/app/lib/passes/catalog';
import { formatWon } from '@/app/lib/passes/display';
export default function PaymentResult({ orderId }: { orderId: string }) {
  const { refreshSubscription } = useAuth();
  const refreshAccess = useEffectEvent(() => {
    void refreshSubscription();
  });
  const [order, setOrder] = useState<PassOrder | null>(null);
  const [error, setError] = useState(false);
  const [delayed, setDelayed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let count = 0;
    async function poll() {
      try {
        const response = await fetch(
          `/api/passes/orders/${encodeURIComponent(orderId)}`,
          { cache: 'no-store', signal: controller.signal },
        );
        if (!response.ok) throw new Error('Query failed');
        const result = await response.json();
        if (controller.signal.aborted) return;
        setOrder(result);
        setError(false);
        if (['CREATING', 'PENDING'].includes(result.status)) {
          if (++count < 20) timer = setTimeout(poll, 3000);
          else setDelayed(true);
        }
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    }
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [orderId, retry]);
  const status = order?.status;
  useEffect(() => {
    if (status && ['PAID', 'REFUNDED', 'PARTIAL_REFUND'].includes(status))
      refreshAccess();
  }, [status]);
  const title = error
    ? '결제 조회 오류'
    : delayed
      ? '결제 확인 지연'
      : order
        ? ORDER_STATUS[order.status] || '상태 확인 필요'
        : '결제 확인 중';
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <section className="space-y-5 rounded-3xl border bg-white p-8 text-center">
        <h1 className="text-2xl font-bold" aria-live="polite">
          {title}
        </h1>
        {order && (
          <p>
            {order.productName} · {formatWon(order.price)}
          </p>
        )}
        {order?.status === 'WAITING_DEPOSIT' && (
          <p className="text-sm text-gray-600">
            PayApp에서 안내한 계좌와 기한을 확인해 주세요. 입금 확인 후 이용권이
            시작됩니다.
          </p>
        )}
        {(delayed || order?.status === 'REVIEW') && (
          <p className="text-sm text-gray-600">
            결제 결과를 확인 중입니다. 중복 결제하지 말고 잠시 후 다시 확인해
            주세요.
          </p>
        )}
        <button
          onClick={() => {
            setDelayed(false);
            setRetry((v) => v + 1);
          }}
          className="rounded-xl border px-5 py-3"
        >
          다시 확인
        </button>
        <Link href="/plan" className="block font-semibold text-[#D93256]">
          내 이용권 확인
        </Link>
        <Link href="/plan/payments" className="block text-sm text-gray-600">
          결제 내역 보기
        </Link>
      </section>
    </main>
  );
}
