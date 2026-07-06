import { X } from 'lucide-react';
import type { ExampleMedia } from '../types';

type Props = {
  media: ExampleMedia | null;
  shouldShowMedia: boolean;
  isLoading: boolean;
  isLoaded: boolean;
  hasExampleReels: boolean;
  guideText: string;
  onClose: () => void;
  onMediaLoad: () => void;
  onMediaError: () => void;
  onOpenReels: () => void;
};

export default function CutExampleModal({
  media,
  shouldShowMedia,
  isLoading,
  isLoaded,
  hasExampleReels,
  guideText,
  onClose,
  onMediaLoad,
  onMediaError,
  onOpenReels,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm rounded-[28px] bg-[#1E2A3B] overflow-hidden relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-30 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>
        {media && (
          <div className="bg-black p-4 pb-3">
            <div className="relative mx-auto w-full max-w-[300px] aspect-[9/16] overflow-hidden rounded-[20px] bg-black">
              {isLoading && (
                <div className="absolute inset-0 z-20 animate-pulse bg-white/10" />
              )}
              {media.type === 'image' ? (
                <>
                  <img
                    src={media.src}
                    alt=""
                    aria-hidden
                    className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-xl"
                  />
                  <img
                    src={media.src}
                    alt="예시 이미지"
                    className={`pointer-events-none absolute inset-0 z-10 h-full w-full object-contain transition-opacity duration-200 ${
                      isLoaded ? 'opacity-100' : 'opacity-0'
                    }`}
                    onLoad={onMediaLoad}
                    onError={onMediaError}
                  />
                </>
              ) : (
                <video
                  src={media.src}
                  controls
                  playsInline
                  preload="metadata"
                  className={`absolute inset-0 z-10 h-full w-full object-contain transition-opacity duration-200 ${
                    isLoaded ? 'opacity-100' : 'opacity-0'
                  }`}
                  onLoadedMetadata={onMediaLoad}
                  onError={onMediaError}
                />
              )}
            </div>
          </div>
        )}
        <div className={`p-5 space-y-4 ${shouldShowMedia ? '' : 'pt-16'}`}>
          <button
            type="button"
            onClick={onOpenReels}
            disabled={!hasExampleReels}
            className="w-full rounded-full bg-[#FF4D6D] py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
          >
            실제 릴스 보기
          </button>
          {!hasExampleReels && (
            <p className="text-xs text-center text-white/55">예시 릴스 준비 중입니다.</p>
          )}
          <div>
            <p className="text-sm font-semibold text-white/80 mb-2">이 컷의 포인트</p>
            <p className="text-xs text-white/60 leading-relaxed">{guideText}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
