type Props = {
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ResetCutModal({ onCancel, onConfirm }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm rounded-[24px] bg-[#1E2A3B] p-6 text-white">
        <h3 className="text-lg font-semibold mb-2">촬영 재시도</h3>
        <p className="text-sm text-white/70 mb-5">
          촬영한 영상을 다시 찍으시겠어요? 현재 영상은 삭제됩니다.
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
            다시 찍기
          </button>
        </div>
      </div>
    </div>
  );
}
