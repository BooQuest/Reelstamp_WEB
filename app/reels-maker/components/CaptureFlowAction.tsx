'use client';

import { Check } from 'lucide-react';

type Props = {
  variant: 'complete' | null;
  disabled: boolean;
  onComplete: () => void;
};

export default function CaptureFlowAction({
  variant,
  disabled,
  onComplete,
}: Props) {
  if (!variant) return null;

  return (
    <button
      type="button"
      onClick={onComplete}
      disabled={disabled}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#FF4D6D] px-4 text-sm font-semibold text-white shadow-lg transition hover:bg-[#ff3f64] disabled:cursor-not-allowed disabled:opacity-45"
    >
      <Check className="h-4 w-4" />
      완료하기
    </button>
  );
}
