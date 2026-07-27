type Props = {
  title?: string;
  description?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function RetakeConfirmModal({
  title = '다시 촬영할까요?',
  description = '현재 컷의 기존 영상은 새 촬영이 저장되면 교체됩니다.',
  confirmLabel = '다시 촬영',
  onCancel,
  onConfirm,
}: Props) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-[24px] bg-[#1E2A3B] p-6 text-white shadow-2xl">
        <h3 className="mb-2 text-lg font-semibold">{title}</h3>
        <p className="mb-5 text-sm leading-6 text-white/70">
          {description}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl bg-white/10 py-2 text-sm"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-[#FF4D6D] py-2 text-sm font-semibold"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
