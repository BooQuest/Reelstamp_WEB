'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import PassSummaryCard from '@/app/components/features/passes/PassSummaryCard';
import QueryFeedback from '@/app/components/features/passes/QueryFeedback';
import type { PassSummary, QueryState } from '@/app/lib/passes/display';

export default function PlanClient({
  state,
  children,
  hasPasses = false,
}: {
  state: QueryState<PassSummary>;
  children?: React.ReactNode;
  hasPasses?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const retry = () => startTransition(() => router.refresh());

  return (
    <div className="min-h-[calc(100vh-80px)] bg-gradient-to-b from-pink-50 to-white px-4 py-8 pb-24 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">내 이용권</h1>
        {children}
        {isPending || state.status === 'loading' ? (
          <QueryFeedback status="loading" subject="이용권 정보" />
        ) : state.status === 'error' ? (
          <QueryFeedback status="error" subject="이용권 정보" onRetry={retry} />
        ) : (
          <PassSummaryCard summary={state.data} hideEmpty={hasPasses} />
        )}
      </div>
    </div>
  );
}
