'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import InstagramEmbed from '@/app/components/ui/InstagramEmbed';
import type { ExampleMedia } from '../types';

type ExampleViewMode = 'cut' | 'reel';

type Props = {
  media: ExampleMedia | null;
  isLoading: boolean;
  isLoaded: boolean;
  guideText: string | null;
  reelUrls: string[];
  currentReelUrl: string | null;
  currentReelIndex: number;
  isFirstReel: boolean;
  isLastReel: boolean;
  onClose: () => void;
  onMediaLoad: () => void;
  onMediaError: () => void;
  onPreviousReel: () => void;
  onNextReel: () => void;
  onSelectReel: (index: number) => void;
};

export default function CutExampleModal({
  media,
  isLoading,
  isLoaded,
  guideText,
  reelUrls,
  currentReelUrl,
  currentReelIndex,
  isFirstReel,
  isLastReel,
  onClose,
  onMediaLoad,
  onMediaError,
  onPreviousReel,
  onNextReel,
  onSelectReel,
}: Props) {
  const hasCutExample = Boolean(media);
  const hasExampleReels = reelUrls.length > 0;
  const hasMultipleViews = hasCutExample && hasExampleReels;
  const trimmedGuideText = guideText?.trim() ?? '';
  const hasGuideText = trimmedGuideText.length > 0;
  const [viewMode, setViewMode] = useState<ExampleViewMode>('cut');

  const activeViewMode: ExampleViewMode | null = hasMultipleViews
    ? viewMode
    : hasCutExample
      ? 'cut'
      : hasExampleReels
        ? 'reel'
        : null;
  const headerTitle =
    activeViewMode === 'cut'
      ? '컷 예시'
      : activeViewMode === 'reel'
        ? '실제 릴스'
        : '촬영 팁';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="relative flex max-h-[calc(100dvh-32px)] w-full max-w-sm flex-col overflow-hidden rounded-[28px] bg-[#1E2A3B] text-white shadow-2xl">
        <div className="flex shrink-0 items-center gap-3 px-4 pt-4">
          {hasMultipleViews ? (
            <div className="grid min-w-0 flex-1 grid-cols-2 rounded-full bg-black/35 p-1">
              <button
                type="button"
                onClick={() => setViewMode('cut')}
                className={`h-9 rounded-full text-xs font-semibold transition ${
                  viewMode === 'cut'
                    ? 'bg-[#FF4D6D] text-white shadow-lg'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                컷 예시
              </button>
              <button
                type="button"
                onClick={() => setViewMode('reel')}
                className={`h-9 rounded-full text-xs font-semibold transition ${
                  viewMode === 'reel'
                    ? 'bg-[#FF4D6D] text-white shadow-lg'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                실제 릴스
              </button>
            </div>
          ) : (
            <p className="min-w-0 flex-1 px-1 text-sm font-semibold text-white/85">
              {headerTitle}
            </p>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/55 text-white"
            aria-label="예시 닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-4">
          {activeViewMode === 'cut' && media && (
            <div className="relative mx-auto aspect-[9/16] w-full max-w-[300px] overflow-hidden rounded-[20px] bg-black">
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
          )}

          {activeViewMode === 'reel' && (
            <div>
              <div className="relative mx-auto aspect-[9/16] w-full max-w-[300px] overflow-hidden rounded-[20px] bg-black">
                {currentReelUrl ? (
                  <InstagramEmbed
                    url={currentReelUrl}
                    className="absolute inset-0 h-full w-full rounded-none"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
                    예시 릴스가 없습니다.
                  </div>
                )}

                {reelUrls.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={onPreviousReel}
                      disabled={isFirstReel}
                      className="absolute left-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-[#FF4D6D] text-white shadow-lg transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label="이전 릴스"
                    >
                      <ChevronLeft className="h-5 w-5 text-white" />
                    </button>
                    <button
                      type="button"
                      onClick={onNextReel}
                      disabled={isLastReel}
                      className="absolute right-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-[#FF4D6D] text-white shadow-lg transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label="다음 릴스"
                    >
                      <ChevronRight className="h-5 w-5 text-white" />
                    </button>
                  </>
                )}
              </div>

              {reelUrls.length > 1 && (
                <>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    {reelUrls.map((url, index) => (
                      <button
                        key={`${url}-${index}`}
                        type="button"
                        onClick={() => onSelectReel(index)}
                        className={`h-2.5 rounded-full transition-all ${
                          index === currentReelIndex
                            ? 'w-6 bg-[#FF4D6D]'
                            : 'w-2.5 bg-white/35'
                        }`}
                        aria-label={`${index + 1}번 릴스로 이동`}
                        aria-current={index === currentReelIndex}
                      />
                    ))}
                  </div>

                  <p className="mt-3 text-center text-xs text-white/55">
                    좌우 버튼 또는 하단 점을 눌러 다른 예시 릴스를 확인하세요.
                  </p>
                </>
              )}
            </div>
          )}

          {!activeViewMode && !hasGuideText && (
            <p className="py-12 text-center text-sm text-white/60">
              등록된 예시가 없습니다.
            </p>
          )}

          {hasGuideText && (
            <div className={activeViewMode ? 'mt-5' : 'pt-8'}>
              <p className="mb-2 text-sm font-semibold text-white/85">이 컷의 포인트</p>
              <p className="text-xs leading-relaxed text-white/60">{trimmedGuideText}</p>
            </div>
          )}

          {activeViewMode === 'reel' && currentReelUrl && (
            <a
              href={currentReelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-[#FF4D6D] py-3 text-sm font-semibold text-white transition hover:brightness-105"
            >
              Instagram에서 열기
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
