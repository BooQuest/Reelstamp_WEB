import type { PointerEvent, RefObject } from 'react';
import { Loader2, Pause, Play, X } from 'lucide-react';
import type { TrimDragMode, VideoMetadata } from '../types';

type Props = {
  viewportRef: RefObject<HTMLDivElement | null>;
  measureRef: RefObject<HTMLDivElement | null>;
  previewContainerRef: RefObject<HTMLDivElement | null>;
  previewVideoRef: RefObject<HTMLVideoElement | null>;
  timelineRef: RefObject<HTMLDivElement | null>;
  sourceUrl: string | null;
  sourceFile: File | null;
  sourceMetadata: VideoMetadata | null;
  previewMaxHeight: number | null;
  isPlaying: boolean;
  thumbnails: string[];
  sliderMax: number;
  startSeconds: number;
  endSeconds: number;
  scrubSeconds: number;
  durationSeconds: number;
  recommendedSeconds: number;
  activeDrag: TrimDragMode;
  error: string | null;
  isProcessing: boolean;
  onClose: () => void;
  onPlayToggle: () => void;
  onScrubPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerDown: (
    event: PointerEvent<HTMLDivElement>,
    mode: Exclude<TrimDragMode, 'none'>
  ) => void;
  secondsToTimelineX: (seconds: number) => number;
  onConfirm: () => void;
};

export default function TrimModal({
  viewportRef,
  measureRef,
  previewContainerRef,
  previewVideoRef,
  timelineRef,
  sourceUrl,
  sourceFile,
  sourceMetadata,
  previewMaxHeight,
  isPlaying,
  thumbnails,
  sliderMax,
  startSeconds,
  endSeconds,
  scrubSeconds,
  durationSeconds,
  recommendedSeconds,
  activeDrag,
  error,
  isProcessing,
  onClose,
  onPlayToggle,
  onScrubPointerDown,
  onPointerDown,
  secondsToTimelineX,
  onConfirm,
}: Props) {
  const previewWidth = previewMaxHeight
    ? `min(100%, ${Math.floor((previewMaxHeight * 9) / 16)}px)`
    : '100%';
  const previewHeight = previewMaxHeight ? `${previewMaxHeight}px` : undefined;

  return (
    <div
      ref={viewportRef}
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-black/80 py-2"
    >
      <div className="w-full max-w-sm px-4">
        <div
          ref={measureRef}
          className="w-full overflow-hidden rounded-[24px] bg-[#1E2A3B] text-white shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <h3 className="text-sm font-semibold">영상 구간 선택</h3>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10"
              aria-label="구간 선택 닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4 p-4">
            <div className="flex justify-center">
              {sourceUrl ? (
                <div
                  ref={previewContainerRef}
                  className="relative aspect-[9/16] overflow-hidden rounded-[18px] bg-black"
                  style={{ width: previewWidth, maxHeight: previewHeight }}
                >
                  <video
                    ref={previewVideoRef}
                    src={sourceUrl}
                    playsInline
                    preload="metadata"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={onPlayToggle}
                    className="absolute bottom-3 left-3 z-10 inline-flex items-center gap-2 rounded-full bg-black/65 px-3 py-2 text-xs font-semibold text-white backdrop-blur"
                    aria-label={isPlaying ? '구간 재생 일시정지' : '선택 구간 재생'}
                  >
                    {isPlaying ? (
                      <Pause className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    {isPlaying ? '일시정지' : '재생'}
                  </button>
                </div>
              ) : (
                <div
                  ref={previewContainerRef}
                  className="flex aspect-[9/16] items-center justify-center rounded-[18px] bg-black text-xs text-white/60"
                  style={{ width: previewWidth, maxHeight: previewHeight }}
                >
                  영상 미리보기를 준비하는 중입니다...
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div
                ref={timelineRef}
                className="relative h-20 rounded-xl border border-white/10 bg-black/40 touch-none select-none"
                onPointerDown={onScrubPointerDown}
              >
                <div className="absolute inset-0 overflow-hidden rounded-xl">
                  {thumbnails.length > 0 ? (
                    <div className="flex h-full">
                      {thumbnails.map((thumbnail, index) => (
                        <img
                          key={`${thumbnail}-${index}`}
                          src={thumbnail}
                          alt=""
                          aria-hidden
                          className="min-w-0 flex-1 object-cover"
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center text-[11px] text-white/55">
                      타임라인 미리보기 생성 중...
                    </div>
                  )}
                  {sliderMax > 0 && (
                    <>
                      <div
                        className="pointer-events-none absolute inset-y-0 left-0 bg-black/60"
                        style={{ width: `${secondsToTimelineX(startSeconds)}%` }}
                      />
                      <div
                        className="pointer-events-none absolute inset-y-0 right-0 bg-black/60"
                        style={{ width: `${100 - secondsToTimelineX(endSeconds)}%` }}
                      />
                    </>
                  )}
                </div>
                {sliderMax > 0 && (
                  <>
                    <div
                      className={`absolute inset-y-0 z-20 rounded-md border-2 bg-white/10 ${
                        activeDrag === 'window' ? 'border-[#4DE8FF]' : 'border-white/90'
                      }`}
                      style={{
                        left: `${secondsToTimelineX(startSeconds)}%`,
                        width: `${Math.max(
                          0.5,
                          secondsToTimelineX(endSeconds) -
                            secondsToTimelineX(startSeconds)
                        )}%`,
                      }}
                      onPointerDown={(event) => onPointerDown(event, 'window')}
                    />
                    <div
                      className="absolute inset-y-0 z-30 w-6 -translate-x-1/2 cursor-ew-resize touch-none"
                      style={{ left: `${secondsToTimelineX(startSeconds)}%` }}
                      onPointerDown={(event) => onPointerDown(event, 'start')}
                    >
                      <div
                        className={`mx-auto h-full w-[3px] rounded-full ${
                          activeDrag === 'start' ? 'bg-[#4DE8FF]' : 'bg-white'
                        }`}
                      />
                    </div>
                    <div
                      className="absolute inset-y-0 z-30 w-6 -translate-x-1/2 cursor-ew-resize touch-none"
                      style={{ left: `${secondsToTimelineX(endSeconds)}%` }}
                      onPointerDown={(event) => onPointerDown(event, 'end')}
                    >
                      <div
                        className={`mx-auto h-full w-[3px] rounded-full ${
                          activeDrag === 'end' ? 'bg-[#4DE8FF]' : 'bg-white'
                        }`}
                      />
                    </div>
                    <div
                      className="absolute z-40 w-7 -translate-x-1/2 cursor-ew-resize touch-none"
                      style={{
                        left: `${secondsToTimelineX(scrubSeconds)}%`,
                        top: '-4px',
                        height: 'calc(100% + 8px)',
                      }}
                      onPointerDown={(event) => onPointerDown(event, 'scrub')}
                    >
                      <div className="pointer-events-none absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]" />
                    </div>
                  </>
                )}
              </div>

              <p className="text-center text-xs text-white/70">
                {scrubSeconds.toFixed(1)}s
              </p>
              <p className="text-center text-xs text-white/70">
                선택 구간 {durationSeconds.toFixed(1)}초 / 권장{' '}
                {recommendedSeconds.toFixed(1)}초
              </p>
            </div>

            {error && <p className="text-center text-xs text-rose-300">{error}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="flex-1 rounded-xl bg-white/10 py-2 text-sm disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isProcessing || !sourceFile || !sourceMetadata}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#00C7E6] py-2 text-sm font-semibold disabled:opacity-50"
              >
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                확인
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
