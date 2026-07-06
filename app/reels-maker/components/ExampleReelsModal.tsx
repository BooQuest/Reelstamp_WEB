import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import InstagramEmbed from '@/app/components/ui/InstagramEmbed';

type Props = {
  urls: string[];
  currentUrl: string | null;
  currentIndex: number;
  isFirst: boolean;
  isLast: boolean;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSelect: (index: number) => void;
};

export default function ExampleReelsModal({
  urls,
  currentUrl,
  currentIndex,
  isFirst,
  isLast,
  onClose,
  onPrevious,
  onNext,
  onSelect,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
      <button
        type="button"
        onClick={onClose}
        className="absolute top-6 right-6 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center"
      >
        <X className="w-5 h-5" />
      </button>
      <div className="w-full max-w-sm">
        <div className="rounded-[28px] overflow-hidden bg-[#1E2A3B] p-4">
          <div className="relative rounded-[20px] overflow-hidden bg-black aspect-[9/16]">
            {currentUrl ? (
              <InstagramEmbed
                url={currentUrl}
                className="absolute inset-0 h-full w-full rounded-none"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
                예시 릴스가 없습니다.
              </div>
            )}

            <button
              type="button"
              onClick={onPrevious}
              disabled={isFirst}
              className="absolute left-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-[#FF4D6D] text-white shadow-lg transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="이전 릴스"
            >
              <ChevronLeft className="h-5 w-5 text-white" />
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={isLast}
              className="absolute right-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-[#FF4D6D] text-white shadow-lg transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="다음 릴스"
            >
              <ChevronRight className="h-5 w-5 text-white" />
            </button>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2">
            {urls.map((url, index) => (
              <button
                key={`${url}-${index}`}
                type="button"
                onClick={() => onSelect(index)}
                className={`h-2.5 rounded-full transition-all ${
                  index === currentIndex ? 'w-6 bg-[#FF4D6D]' : 'w-2.5 bg-white/35'
                }`}
                aria-label={`${index + 1}번 릴스로 이동`}
                aria-current={index === currentIndex}
              />
            ))}
          </div>

          <p className="mt-3 text-center text-xs text-white/60">
            좌우 버튼 또는 하단 점을 눌러 다른 예시 릴스를 확인하세요.
          </p>
          {currentUrl && (
            <a
              href={currentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-[#FF4D6D] py-3 text-sm font-semibold text-white hover:brightness-105 transition"
            >
              Instagram에서 열기
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
