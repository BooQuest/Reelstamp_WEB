'use client';

/* eslint-disable @next/next/no-img-element */

import { useMemo, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight, Play, X } from 'lucide-react';
import InstagramEmbed from '@/app/components/ui/InstagramEmbed';
import type { TemplateExampleReel } from '../types';
import { isVideoAssetUrl } from '../utils/assets';

export type TemplateGuideStep = 'overview' | number;

export type TemplateGuideCut = {
  order: number;
  title?: string | null;
  guideText?: string | null;
  exampleImageUrl?: string | null;
  exampleVideoUrl?: string | null;
  isFixed?: boolean;
};

type Props = {
  templateTitle: string;
  templateOverview?: string | null;
  cuts: TemplateGuideCut[];
  step: TemplateGuideStep;
  exampleReels: TemplateExampleReel[];
  currentReelIndex: number;
  onClose: () => void;
  onSelectStep: (step: TemplateGuideStep) => void;
  onPrimaryAction: () => void;
  onSelectReel: (index: number) => void;
};

const FALLBACK_OVERVIEW = '템플릿의 전체 흐름을 확인한 뒤 컷별 가이드를 따라 촬영해보세요.';
const FALLBACK_CUT_GUIDE = '등록된 컷별 촬영 가이드가 없습니다.';
const GUIDE_NAV_AVAILABLE_WIDTH = 320;
const GUIDE_NAV_MAX_STEP_SIZE = 36;
const GUIDE_NAV_MIN_STEP_SIZE = 16;
const GUIDE_NAV_COMPACT_CONNECTOR_WIDTH = 36;

const getTrimmedText = (value?: string | null) => value?.trim() ?? '';

export default function TemplateGuideModal({
  templateTitle,
  templateOverview,
  cuts,
  step,
  exampleReels,
  currentReelIndex,
  onClose,
  onSelectStep,
  onPrimaryAction,
  onSelectReel,
}: Props) {
  const activeCutIndex = typeof step === 'number' ? step : null;
  const activeCut = activeCutIndex === null ? null : cuts[activeCutIndex] ?? null;
  const currentReel = exampleReels[currentReelIndex] ?? null;
  const [loadedMediaBySrc, setLoadedMediaBySrc] = useState<Record<string, boolean>>({});
  const guideSteps = useMemo<TemplateGuideStep[]>(
    () => ['overview', ...cuts.map((_, index) => index)],
    [cuts]
  );
  const currentGuideStepIndex = guideSteps.findIndex((guideStep) => guideStep === step);
  const canShowPreviousGuideStep = currentGuideStepIndex > 0;
  const canShowNextGuideStep =
    currentGuideStepIndex >= 0 && currentGuideStepIndex < guideSteps.length - 1;
  const guideStepCount = guideSteps.length;
  const guideConnectorMinWidth =
    guideStepCount > 10 ? 2 : guideStepCount > 7 ? 4 : 8;
  const guideOverviewExtraWidth =
    guideStepCount > 10 ? 6 : guideStepCount > 7 ? 8 : 14;
  const guideStepSize = Math.max(
    GUIDE_NAV_MIN_STEP_SIZE,
    Math.min(
      GUIDE_NAV_MAX_STEP_SIZE,
      Math.floor(
        (GUIDE_NAV_AVAILABLE_WIDTH -
          guideOverviewExtraWidth -
          Math.max(0, guideStepCount - 1) * guideConnectorMinWidth) /
          Math.max(1, guideStepCount)
      )
    )
  );
  const guideStepTextClass =
    guideStepSize < 20 ? 'text-[10px]' : guideStepSize < 24 ? 'text-[11px]' : 'text-xs';
  const guideOverviewStyle: CSSProperties = {
    width: guideStepSize + guideOverviewExtraWidth,
    height: guideStepSize,
  };
  const guideStepStyle: CSSProperties = {
    width: guideStepSize,
    height: guideStepSize,
  };
  const guideConnectorStyle: CSSProperties = {
    minWidth: guideConnectorMinWidth,
  };
  const guideCompactNavWidth =
    guideStepSize +
    guideOverviewExtraWidth +
    Math.max(0, guideStepCount - 1) *
      (guideStepSize + GUIDE_NAV_COMPACT_CONNECTOR_WIDTH);
  const guideNavStyle: CSSProperties = {
    width: Math.min(GUIDE_NAV_AVAILABLE_WIDTH, guideCompactNavWidth),
    maxWidth: '100%',
  };

  const cutMedia = useMemo(() => {
    const imageUrl = getTrimmedText(activeCut?.exampleImageUrl);
    if (imageUrl) {
      return {
        type: isVideoAssetUrl(imageUrl) ? 'video' : 'image',
        src: imageUrl,
      } as const;
    }

    const videoUrl = getTrimmedText(activeCut?.exampleVideoUrl);
    if (videoUrl) {
      return {
        type: 'video',
        src: videoUrl,
      } as const;
    }

    return null;
  }, [activeCut?.exampleImageUrl, activeCut?.exampleVideoUrl]);

  const markMediaLoaded = (src: string) => {
    setLoadedMediaBySrc((prev) => (prev[src] ? prev : { ...prev, [src]: true }));
  };

  const title =
    step === 'overview'
      ? templateTitle
      : getTrimmedText(activeCut?.title) || `${(activeCutIndex ?? 0) + 1}컷`;
  const body =
    step === 'overview'
      ? getTrimmedText(templateOverview) || FALLBACK_OVERVIEW
      : getTrimmedText(activeCut?.guideText) || FALLBACK_CUT_GUIDE;
  const bodyHeading = step === 'overview' ? '템플릿 개요' : '이 컷의 포인트';

  const nextCaptureCutIndex =
    activeCutIndex === null
      ? -1
      : cuts.findIndex((cut, index) => index > activeCutIndex && !cut.isFixed);
  const primaryLabel =
    step === 'overview'
      ? '다음'
      : activeCut?.isFixed && nextCaptureCutIndex >= 0
        ? `${nextCaptureCutIndex + 1}컷 가이드 보기`
        : activeCut?.isFixed
          ? '촬영 완료 확인하기'
          : `${(activeCutIndex ?? 0) + 1}컷 촬영하기`;

  const handlePreviousGuideStep = () => {
    if (!canShowPreviousGuideStep) return;
    onSelectStep(guideSteps[currentGuideStepIndex - 1]);
  };

  const handleNextGuideStep = () => {
    if (!canShowNextGuideStep) return;
    onSelectStep(guideSteps[currentGuideStepIndex + 1]);
  };

  const renderGuideStepNavigation = () => {
    if (guideSteps.length <= 1) return null;

    return (
      <>
        {canShowPreviousGuideStep && (
          <button
            type="button"
            onClick={handlePreviousGuideStep}
            className="absolute left-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/55 text-white shadow-lg transition-transform hover:scale-105"
            aria-label="이전 가이드"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {canShowNextGuideStep && (
          <button
            type="button"
            onClick={handleNextGuideStep}
            className="absolute right-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/55 text-white shadow-lg transition-transform hover:scale-105"
            aria-label="다음 가이드"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </>
    );
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="relative flex max-h-[calc(100dvh-32px)] w-full max-w-sm flex-col overflow-hidden rounded-[28px] bg-[#1E2A3B] text-white shadow-2xl">
        <div className="relative h-[52px] shrink-0 px-4 pt-4">
          <h2 className="pointer-events-none absolute inset-x-0 top-5 min-w-0 text-center text-lg font-semibold">
            템플릿 가이드
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/55 text-white"
            aria-label="템플릿 가이드 닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mx-4 mt-5">
          <div
            className="mx-auto flex items-center justify-center"
            style={guideNavStyle}
          >
            <button
              type="button"
              onClick={() => onSelectStep('overview')}
              style={guideOverviewStyle}
              className={`flex shrink-0 items-center justify-center rounded-full ${guideStepTextClass} font-bold transition ${
                step === 'overview'
                  ? 'bg-[#FF4D6D] text-white shadow-lg shadow-[#FF4D6D]/25'
                  : 'bg-[#111A29] text-white/90 hover:text-white'
              }`}
              aria-current={step === 'overview'}
            >
              전체
            </button>
            {cuts.map((cut, index) => {
              const isActive = step === index;
              return (
                <div key={`${cut.order}-${index}`} className="flex min-w-0 flex-1 items-center">
                  <span
                    className="h-px min-w-0 flex-1 bg-white/65"
                    style={guideConnectorStyle}
                    aria-hidden
                  />
                  <button
                    type="button"
                    onClick={() => onSelectStep(index)}
                    style={guideStepStyle}
                    className={`flex shrink-0 items-center justify-center rounded-full ${guideStepTextClass} font-bold transition ${
                      isActive
                        ? 'bg-[#FF4D6D] text-white shadow-lg shadow-[#FF4D6D]/25'
                        : 'bg-[#111A29] text-white/90 hover:text-white'
                    }`}
                    aria-label={`컷${index + 1}`}
                    aria-current={isActive}
                  >
                    {index + 1}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-4">
          <div className="relative -mx-4">
            <div className="relative mx-auto aspect-[9/16] w-full max-w-[220px] overflow-hidden rounded-[20px] bg-black sm:max-w-[230px]">
              {cutMedia ? (
                cutMedia.type === 'image' ? (
                  <>
                    <img
                      src={cutMedia.src}
                      alt=""
                      aria-hidden
                      className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-xl"
                    />
                    <img
                      src={cutMedia.src}
                      alt="컷 예시"
                      className={`pointer-events-none absolute inset-0 z-10 h-full w-full object-contain transition-opacity duration-200 ${
                        loadedMediaBySrc[cutMedia.src] ? 'opacity-100' : 'opacity-0'
                      }`}
                      onLoad={() => markMediaLoaded(cutMedia.src)}
                    />
                  </>
                ) : (
                  <video
                    src={cutMedia.src}
                    controls
                    playsInline
                    preload="metadata"
                    className={`absolute inset-0 z-10 h-full w-full object-contain transition-opacity duration-200 ${
                      loadedMediaBySrc[cutMedia.src] ? 'opacity-100' : 'opacity-0'
                    }`}
                    onLoadedMetadata={() => markMediaLoaded(cutMedia.src)}
                  />
                )
              ) : currentReel ? (
                <InstagramEmbed
                  url={currentReel.url}
                  className="absolute inset-0 h-full w-full rounded-none"
                  instagramOnly={Boolean(currentReel.instagramOnly)}
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/60">
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-white/15">
                    <Play className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-semibold">예시 준비중</p>
                </div>
              )}
            </div>
            {renderGuideStepNavigation()}
          </div>

          {!cutMedia && exampleReels.length > 1 && currentReel && (
            <div className="mt-3 flex items-center justify-center gap-2">
              {exampleReels.map((reel, index) => (
                <button
                  key={`${reel.url}-${index}`}
                  type="button"
                  onClick={() => onSelectReel(index)}
                  className={`h-2 rounded-full transition-all ${
                    index === currentReelIndex ? 'w-5 bg-[#FF4D6D]' : 'w-2 bg-white/35'
                  }`}
                  aria-label={`${index + 1}번 릴스로 이동`}
                  aria-current={index === currentReelIndex}
                />
              ))}
            </div>
          )}

          <div className="mt-5">
            <h3 className="text-base font-bold text-white">{title}</h3>
            <p className="mt-3 text-sm font-semibold text-white/85">{bodyHeading}</p>
            <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-white/65">
              {body}
            </p>
          </div>
        </div>

        <div className="shrink-0 px-4 pb-4">
          <button
            type="button"
            onClick={onPrimaryAction}
            className="h-12 w-full rounded-full bg-[#FF4D6D] px-4 text-sm font-semibold text-white shadow-lg transition hover:brightness-105"
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
