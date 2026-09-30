import QueryFeedback from '@/app/components/features/passes/QueryFeedback';

export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <QueryFeedback status="loading" subject="결제 내역" />
    </div>
  );
}
