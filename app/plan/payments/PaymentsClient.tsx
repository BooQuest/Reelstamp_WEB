'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import PaymentHistory from '@/app/components/features/passes/PaymentHistory';
import QueryFeedback from '@/app/components/features/passes/QueryFeedback';
import type { PaymentRecord, QueryState } from '@/app/lib/passes/display';

export default function PaymentsClient({ state }: { state: QueryState<PaymentRecord[]> }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const retry = () => startTransition(() => router.refresh());

  return (
    <div className="min-h-[calc(100vh-80px)] bg-gray-50 px-4 py-8 pb-24 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/plan"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-[#D93256]"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />내 이용권
        </Link>
        <h1 className="mb-6 text-2xl font-bold text-gray-900">결제 내역</h1>
        {isPending || state.status === 'loading' ? (
          <QueryFeedback status="loading" subject="결제 내역" />
        ) : state.status === 'error' ? (
          <QueryFeedback status="error" subject="결제 내역" onRetry={retry} />
        ) : (
          <PaymentHistory payments={state.data} />
        )}
      </div>
    </div>
  );
}
