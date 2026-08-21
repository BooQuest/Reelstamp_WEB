'use client';

import { Check, ChevronRight } from 'lucide-react';

type Props = {
  variant: 'next' | 'complete' | null;
  disabled: boolean;
  onNext: () => void;
  onComplete: () => void;
};

export default function CaptureFlowAction({
  variant,
  disabled,
  onNext,
  onComplete,
}: Props) {
  if (!variant) return null;

  const isComplete = variant === 'complete';
  const label = isComplete ? '완료하기' : '다음 컷 촬영';
  const Icon = isComplete ? Check : ChevronRight;

  return (
    <button
      type="button"
      onClick={isComplete ? onComplete : onNext}
      disabled={disabled}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#FF4D6D] px-4 text-sm font-semibold text-white shadow-lg transition hover:bg-[#ff3f64] disabled:cursor-not-allowed disabled:opacity-45"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
