import { Image as ImageIcon, Video, X } from 'lucide-react';

type Props = {
  isBusy: boolean;
  onClose: () => void;
  onSelectVideoCapture: () => void;
  onSelectGallery: () => void;
};

export default function CutMediaSourceModal({
  isBusy,
  onClose,
  onSelectVideoCapture,
  onSelectGallery,
}: Props) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 px-4 pb-5 pt-8 backdrop-blur-sm sm:items-center sm:pb-8">
      <div className="w-full max-w-sm rounded-[24px] bg-[#1E2A3B] p-5 text-white shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-base font-semibold">미디어 추가</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 disabled:opacity-45"
            aria-label="미디어 추가 닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={onSelectVideoCapture}
            disabled={isBusy}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#FF4D6D] px-4 text-sm font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Video className="h-5 w-5" />
            영상 촬영
          </button>
          <button
            type="button"
            onClick={onSelectGallery}
            disabled={isBusy}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            <ImageIcon className="h-5 w-5" />
            갤러리
          </button>
        </div>
      </div>
    </div>
  );
}
