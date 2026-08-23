'use client';

import { Captions } from 'lucide-react';

type Props = {
  onSkip: () => void;
  onEdit: () => void;
  onCancel: () => void;
};

export default function CaptionEditDecisionModal({
  onSkip,
  onEdit,
  onCancel,
}: Props) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="caption-edit-decision-title"
        className="w-full max-w-sm rounded-3xl bg-white p-6 text-slate-900 shadow-2xl"
      >
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[#FF4D6D]/10 text-[#FF4D6D]">
          <Captions className="h-6 w-6" />
        </div>
        <h2 id="caption-edit-decision-title" className="text-xl font-bold">
          자막을 편집할까요?
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          필요하면 자막의 문구와 위치를 조정할 수 있습니다. 건너뛰면
          현재 자막 그대로 릴스 제작을 시작합니다.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="h-12 rounded-full border border-slate-300 text-sm font-bold text-slate-700"
          >
            편집 없이 완료
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="h-12 rounded-full bg-[#FF4D6D] text-sm font-bold text-white"
          >
            자막 편집하기
          </button>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="mt-3 h-10 w-full text-sm font-bold text-slate-500"
        >
          취소
        </button>
      </div>
    </div>
  );
}
