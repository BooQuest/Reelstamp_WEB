import { LoaderCircle } from 'lucide-react';

export default function QueryFeedback({
  status,
  subject,
  onRetry,
}: {
  status: 'loading' | 'error';
  subject: '이용권 정보' | '결제 내역';
  onRetry?: () => void;
}) {
  const object = subject === '결제 내역' ? `${subject}을` : `${subject}를`;
  if (status === 'loading')
    return (
      <div
        role="status"
        className="rounded-3xl border border-gray-100 bg-white p-8 text-center text-gray-600"
      >
        <LoaderCircle aria-hidden="true" className="mx-auto mb-3 h-6 w-6 animate-spin" />
        {object} 불러오는 중입니다.
      </div>
    );
  return (
    <div role="alert" className="rounded-3xl border border-gray-200 bg-white p-8 text-center">
      <h2 className="font-bold text-gray-900">{object} 불러오지 못했습니다.</h2>
      <p className="mt-2 text-sm text-gray-500">잠시 후 다시 확인해주세요.</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 rounded-xl border border-gray-300 px-5 py-3 font-semibold text-gray-700"
        >
          다시 시도
        </button>
      )}
    </div>
  );
}
