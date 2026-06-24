'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Mic,
  Pause,
  Play,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  DEFAULT_CAPTION_STYLE,
  MAX_CAPTIONS_PER_CLIP,
} from '../constants';
import type {
  AutoCaptionJobResponse,
  CaptionItem,
  ClipInfo,
} from '../types';
import { createCaptionId } from '../utils/captions';
import CaptionOverlayStage from './CaptionOverlayStage';

type Cut = {
  order: number;
  label: string;
  isFixed: boolean;
};

const isAutoSpeechCaption = (caption: CaptionItem) =>
  caption.source === 'AUTO' && caption.role === 'SPEECH';

type Props = {
  sessionId: number;
  cuts: Cut[];
  clips: Array<ClipInfo | null>;
  clipPosters: Record<number, string>;
  sessionClipMap: Record<number, number>;
  captions: CaptionItem[];
  setCaptions: Dispatch<SetStateAction<CaptionItem[]>>;
  activeCutIndex: number;
  setActiveCutIndex: Dispatch<SetStateAction<number>>;
  captionsEnabled: boolean;
  setCaptionsEnabled: Dispatch<SetStateAction<boolean>>;
  autoCaptionAvailable: boolean;
  remainingAttempts: number;
  staleClipIds: number[];
  acceptedStaleClipIds: number[];
  job: AutoCaptionJobResponse | null;
  jobError: string | null;
  isProcessing: boolean;
  isRegisteredUser: boolean;
  loginHref: string;
  onStartAutoCaption: () => Promise<unknown>;
  onAcceptStale: (clipIds: number[]) => void;
  onBack: () => void;
  onComplete: () => void;
  handleFrameRef: (element: HTMLDivElement | null) => void;
  captionStageRef: MutableRefObject<HTMLDivElement | null>;
  captionOverlayRef: MutableRefObject<HTMLDivElement | null>;
  captionInputRef: MutableRefObject<HTMLInputElement | null>;
  captionPreviewScale: number;
  selectedCaptionId: string | null;
  editingCaptionId: string | null;
  setSelectedCaptionId: (captionId: string | null) => void;
  setEditingCaptionId: (captionId: string | null) => void;
  onCaptionPointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    caption: CaptionItem
  ) => void;
  onCaptionPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onCaptionPointerEnd: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizePointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onResizePointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onResizePointerEnd: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onCaptionTextChange: (value: string) => void;
  onToggleBox: () => void;
};

export default function AutoCaptionEditor({
  sessionId,
  cuts,
  clips,
  clipPosters,
  sessionClipMap,
  captions,
  setCaptions,
  activeCutIndex,
  setActiveCutIndex,
  captionsEnabled,
  setCaptionsEnabled,
  autoCaptionAvailable,
  remainingAttempts,
  staleClipIds,
  acceptedStaleClipIds,
  job,
  jobError,
  isProcessing,
  isRegisteredUser,
  loginHref,
  onStartAutoCaption,
  onAcceptStale,
  onBack,
  onComplete,
  handleFrameRef,
  captionStageRef,
  captionOverlayRef,
  captionInputRef,
  captionPreviewScale,
  selectedCaptionId,
  editingCaptionId,
  setSelectedCaptionId,
  setEditingCaptionId,
  onCaptionPointerDown,
  onCaptionPointerMove,
  onCaptionPointerEnd,
  onResizePointerDown,
  onResizePointerMove,
  onResizePointerEnd,
  onCaptionTextChange,
  onToggleBox,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const activeClipId = sessionClipMap[cuts[activeCutIndex]?.order] ?? null;
  const activeCaptions = useMemo(
    () =>
      activeClipId == null
        ? []
        : captions
            .filter(
              (caption) =>
                caption.placement.type === 'CLIP' &&
                caption.placement.clipId === activeClipId
            )
            .sort((a, b) => a.zIndex - b.zIndex),
    [activeClipId, captions]
  );
  const resultByClip = useMemo(
    () => new Map((job?.clips ?? []).map((result) => [result.clipId, result])),
    [job?.clips]
  );
  const unresolvedStaleIds = staleClipIds.filter(
    (clipId) => !acceptedStaleClipIds.includes(clipId)
  );

  useEffect(() => {
    const key = `reelstamp:auto-caption-prompt:${sessionId}`;
    const timer = window.setTimeout(() => {
      if (
        isRegisteredUser &&
        autoCaptionAvailable &&
        !job &&
        !isProcessing &&
        sessionStorage.getItem(key) !== 'seen'
      ) {
        setShowPrompt(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [autoCaptionAvailable, isProcessing, isRegisteredUser, job, sessionId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    if (isPlaying) void video.play().catch(() => setIsPlaying(false));
  }, [activeCutIndex, isPlaying]);

  const markPromptSeen = () => {
    sessionStorage.setItem(`reelstamp:auto-caption-prompt:${sessionId}`, 'seen');
    setShowPrompt(false);
  };

  const startAutoCaption = async (regenerate = false) => {
    if (
      regenerate &&
      !window.confirm(
        '기존 음성인식 자막만 새 결과로 교체합니다. 템플릿/사용자 자막은 유지됩니다.'
      )
    ) {
      return;
    }
    markPromptSeen();
    await onStartAutoCaption();
  };

  const updateCaptionText = (captionId: string, text: string) => {
    if (isProcessing) return;
    setCaptions((current) =>
      current.map((caption) =>
        caption.id === captionId ? { ...caption, text } : caption
      )
    );
  };

  const deleteCaption = (captionId: string) => {
    if (isProcessing) return;
    setCaptions((current) => current.filter((caption) => caption.id !== captionId));
    if (selectedCaptionId === captionId) setSelectedCaptionId(null);
  };

  const addCaption = (clipId: number) => {
    if (isProcessing) return;
    const clipCaptions = captions.filter(
      (caption) =>
        caption.placement.type === 'CLIP' && caption.placement.clipId === clipId
    );
    const overlayCaptionCount = clipCaptions.filter(
      (caption) => !isAutoSpeechCaption(caption)
    ).length;
    if (overlayCaptionCount >= MAX_CAPTIONS_PER_CLIP) return;
    const id = createCaptionId();
    const nextZIndex =
      clipCaptions.reduce((max, caption) => Math.max(max, caption.zIndex), 0) + 1;
    setCaptions((current) => [
      ...current,
      {
        id,
        text: '',
        source: 'USER',
        role: 'OVERLAY',
        placement: { type: 'CLIP', clipId },
        zIndex: nextZIndex,
        style: {
          ...DEFAULT_CAPTION_STYLE,
          yRatio: Math.min(
            0.68,
            DEFAULT_CAPTION_STYLE.yRatio + overlayCaptionCount * 0.1
          ),
        },
      },
    ]);
    setSelectedCaptionId(id);
    setEditingCaptionId(id);
  };

  const movePlayback = (direction: -1 | 1) => {
    setActiveCutIndex((current) =>
      Math.max(0, Math.min(cuts.length - 1, current + direction))
    );
  };

  const handleEnded = () => {
    if (activeCutIndex < cuts.length - 1) {
      setActiveCutIndex(activeCutIndex + 1);
      return;
    }
    setIsPlaying(false);
  };

  return (
    <div className="min-h-[100dvh] bg-[#F6F7FA] text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            disabled={isProcessing}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-100 disabled:opacity-35"
            aria-label="촬영 화면으로 돌아가기"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-bold">자막 편집</h1>
          <button
            type="button"
            onClick={onComplete}
            disabled={isProcessing || unresolvedStaleIds.length > 0}
            className="rounded-full bg-blue-600 px-5 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            완료
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-5 p-4 lg:grid-cols-[390px_1fr]">
        <section>
          <div
            ref={handleFrameRef}
            className="relative mx-auto aspect-[9/16] w-full max-w-[390px] overflow-hidden rounded-3xl bg-slate-900 shadow-xl"
            onPointerDownCapture={(event) => {
              if (!editingCaptionId) return;
              const target = event.target as Node;
              if (captionOverlayRef.current?.contains(target)) return;
              setEditingCaptionId(null);
            }}
          >
            {clips[activeCutIndex]?.url ? (
              <video
                ref={videoRef}
                src={clips[activeCutIndex]!.url}
                poster={clipPosters[activeCutIndex]}
                playsInline
                className="absolute inset-0 h-full w-full object-cover"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={handleEnded}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-white/60">
                영상을 불러오는 중입니다.
              </div>
            )}
            {captionsEnabled && activeCaptions.length > 0 && (
              <CaptionOverlayStage
                captions={activeCaptions}
                selectedCaptionId={selectedCaptionId}
                editingCaptionId={editingCaptionId}
                previewScale={captionPreviewScale}
                stageRef={captionStageRef}
                overlayRef={captionOverlayRef}
                inputRef={captionInputRef}
                readOnly={isProcessing}
                onSelect={setSelectedCaptionId}
                onEdit={setEditingCaptionId}
                onTextChange={onCaptionTextChange}
                onCaptionPointerDown={onCaptionPointerDown}
                onCaptionPointerMove={onCaptionPointerMove}
                onCaptionPointerEnd={onCaptionPointerEnd}
                onResizePointerDown={onResizePointerDown}
                onResizePointerMove={onResizePointerMove}
                onResizePointerEnd={onResizePointerEnd}
              />
            )}
            <div className="absolute right-3 top-3 z-30 flex items-center gap-2 rounded-full bg-black/55 px-3 py-2 text-xs font-semibold text-white">
              자막 표시
              <button
                type="button"
                role="switch"
                aria-checked={captionsEnabled}
                disabled={isProcessing}
                onClick={() => setCaptionsEnabled((enabled) => !enabled)}
                className={`relative h-6 w-11 rounded-full transition disabled:opacity-40 ${
                  captionsEnabled ? 'bg-blue-500' : 'bg-slate-500'
                }`}
              >
                <span
                  className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
                    captionsEnabled ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="mx-auto mt-3 flex max-w-[390px] items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => movePlayback(-1)}
              disabled={activeCutIndex === 0}
              className="rounded-full p-2 disabled:opacity-30"
              aria-label="이전 컷"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={() => {
                const video = videoRef.current;
                if (!video) return;
                if (video.paused) void video.play();
                else video.pause();
              }}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white"
              aria-label={isPlaying ? '일시 정지' : '재생'}
            >
              {isPlaying ? <Pause /> : <Play className="ml-1" />}
            </button>
            <button
              type="button"
              onClick={() => movePlayback(1)}
              disabled={activeCutIndex === cuts.length - 1}
              className="rounded-full p-2 disabled:opacity-30"
              aria-label="다음 컷"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={onToggleBox}
              disabled={!selectedCaptionId || isProcessing}
              className="rounded-full border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-40"
            >
              텍스트 박스
            </button>
          </div>
        </section>

        <section className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-bold">자막 목록</h2>
              <p className="text-xs text-slate-500">컷별로 묶여 있어요</p>
            </div>
            {isRegisteredUser && autoCaptionAvailable ? (
              <button
                type="button"
                disabled={isProcessing || remainingAttempts <= 0}
                onClick={() => void startAutoCaption(Boolean(job))}
                className="flex items-center gap-2 rounded-full border border-blue-500 px-4 py-2 text-sm font-bold text-blue-600 disabled:opacity-40"
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
                {job ? '다시 생성' : '음성으로 만들기'} ({remainingAttempts})
              </button>
            ) : (
              <a
                href={loginHref}
                className="rounded-full border border-blue-500 px-4 py-2 text-sm font-bold text-blue-600"
              >
                로그인 후 자동 생성
              </a>
            )}
          </div>

          {(jobError || job?.status === 'FAILED') && (
            <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {jobError || '자동자막 생성에 실패했습니다. 기존 자막은 유지됩니다.'}
            </p>
          )}
          {isProcessing && (
            <p className="mb-3 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-700">
              음성을 분석하고 있습니다. 완료될 때까지 자막 편집이 잠깁니다.
            </p>
          )}
          {unresolvedStaleIds.length > 0 && (
            <div className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              <p>영상이 변경된 컷의 자동자막을 확인해 주세요.</p>
              <button
                type="button"
                onClick={() => onAcceptStale(staleClipIds)}
                disabled={isProcessing}
                className="mt-2 font-bold underline"
              >
                현재 자막 그대로 사용
              </button>
            </div>
          )}

          <div className="space-y-2">
            {cuts.map((cut, index) => {
              const clipId = sessionClipMap[cut.order] ?? -1;
              const clipCaptions = captions
                .filter(
                  (caption) =>
                    caption.placement.type === 'CLIP' &&
                    caption.placement.clipId === clipId
                )
                .sort((a, b) => a.zIndex - b.zIndex);
              const overlayCaptionCount = clipCaptions.filter(
                (caption) => !isAutoSpeechCaption(caption)
              ).length;
              const result = resultByClip.get(clipId);
              const stale = staleClipIds.includes(clipId);
              return (
                <article
                  key={cut.order}
                  className={`rounded-2xl border bg-white p-3 transition ${
                    index === activeCutIndex
                      ? 'border-blue-500 ring-2 ring-blue-100'
                      : 'border-slate-200'
                  }`}
                  onClick={() => setActiveCutIndex(index)}
                >
                  <div className="flex gap-3">
                    <button
                      type="button"
                      className="h-20 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-200"
                      onClick={() => setActiveCutIndex(index)}
                    >
                      {clipPosters[index] ? (
                        <img
                          src={clipPosters[index]}
                          alt={`컷 ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </button>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center gap-2 text-xs">
                        <strong>컷 {index + 1}</strong>
                        {cut.isFixed && <span className="text-slate-400">고정 영상</span>}
                        {index === activeCutIndex && (
                          <span className="font-semibold text-blue-600">재생 중</span>
                        )}
                        {result?.status === 'NO_SPEECH' && (
                          <span className="text-amber-600">음성 없음</span>
                        )}
                        {result?.status === 'FAILED' && (
                          <span className="text-rose-600">인식 실패</span>
                        )}
                        {result?.needsReview && (
                          <span className="text-amber-600">긴 자막 확인</span>
                        )}
                        {stale && <span className="text-rose-600">영상 변경됨</span>}
                      </div>
                      {clipCaptions.length === 0 ? (
                        <div className="flex items-center justify-between text-sm text-slate-400">
                          <span>자막 없음</span>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              addCaption(clipId);
                            }}
                            disabled={isProcessing}
                            className="rounded-full border border-dashed border-blue-500 px-3 py-1 font-semibold text-blue-600 disabled:opacity-40"
                          >
                            + 자막 추가
                          </button>
                        </div>
                      ) : (
                        clipCaptions.map((caption) => (
                          <div key={caption.id} className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex items-center gap-1">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    isAutoSpeechCaption(caption)
                                      ? 'bg-blue-50 text-blue-600'
                                      : 'bg-slate-100 text-slate-500'
                                  }`}
                                >
                                  {isAutoSpeechCaption(caption)
                                    ? '음성인식'
                                    : caption.source === 'TEMPLATE'
                                      ? '기본 자막'
                                      : '사용자 자막'}
                                </span>
                              </div>
                              <textarea
                                value={caption.text}
                                onFocus={() => {
                                  setActiveCutIndex(index);
                                  setSelectedCaptionId(caption.id);
                                }}
                                onChange={(event) =>
                                  updateCaptionText(caption.id, event.target.value)
                                }
                                disabled={isProcessing}
                                rows={Math.max(1, caption.text.split('\n').length)}
                                className="min-h-10 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-slate-50"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                deleteCaption(caption.id);
                              }}
                              disabled={isProcessing}
                              className="p-2 text-slate-400 hover:text-rose-600 disabled:opacity-30"
                              aria-label="자막 삭제"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))
                      )}
                      {clipCaptions.length > 0 &&
                        overlayCaptionCount < MAX_CAPTIONS_PER_CLIP && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              addCaption(clipId);
                            }}
                            disabled={isProcessing}
                            className="flex items-center gap-1 text-xs font-bold text-blue-600 disabled:opacity-40"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            자막 추가 ({overlayCaptionCount}/{MAX_CAPTIONS_PER_CLIP})
                          </button>
                        )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>

      {showPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <Mic className="mb-3 h-8 w-8 text-blue-600" />
            <h2 className="text-xl font-bold">음성으로 자막을 만들까요?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              촬영한 영상의 오디오가 음성인식 서비스로 전송됩니다. 생성된
              자막은 컷별로 직접 수정할 수 있습니다.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={markPromptSeen}
                className="rounded-full border border-slate-300 py-3 text-sm font-bold"
              >
                나중에
              </button>
              <button
                type="button"
                onClick={() => void startAutoCaption(false)}
                className="rounded-full bg-blue-600 py-3 text-sm font-bold text-white"
              >
                지금 만들기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
