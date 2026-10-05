'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { MakerCut, SubmitClip, TrimDragMode, TrimDragStartState, VideoMetadata, VideoDebugLogger } from '../types';
import { MIN_TRIM_DURATION_SECONDS } from '../constants';
import { clampValue } from '../utils/captions';
import { getErrorMessage } from '../utils/errors';
import { loadVideoMetadataFromUrl } from '../utils/media/metadata';
import { generateTimelineThumbnails } from '../utils/media/previews';
import useTrimPreviewLayout from './useTrimPreviewLayout';
import { captureVideoSegmentToBlob } from '../utils/media/videoSegment';

type Options = {
  cuts: MakerCut[];
  activeCutIndex: number;
  onSubmit: SubmitClip;
  logVideoDebug: VideoDebugLogger;
};

export default function useVideoTrim({ cuts, activeCutIndex, onSubmit, logVideoDebug }: Options) {
  const activeCut = cuts[activeCutIndex] ?? null;
  const operationRef = useRef(0);
  const preparationRef = useRef<AbortController | null>(null);
  const conversionRef = useRef<AbortController | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const trimPreviewVideoRef = useRef<HTMLVideoElement | null>(null);

  const trimTimelineRef = useRef<HTMLDivElement | null>(null);

  const trimPlaybackRafRef = useRef<number | null>(null);

  const trimDragPointerIdRef = useRef<number | null>(null);

  const trimDragStartRef = useRef<TrimDragStartState | null>(null);

  const trimBoundsRef = useRef({ start: 0, end: 0, scrub: 0 });

  const [trimTargetCutIndex, setTrimTargetCutIndex] = useState<number | null>(null);

  const [isTrimOpen, setIsTrimOpen] = useState(false);

  const [trimSourceFile, setTrimSourceFile] = useState<File | null>(null);

  const [trimSourceUrl, setTrimSourceUrl] = useState<string | null>(null);

  const [trimSourceMetadata, setTrimSourceMetadata] = useState<VideoMetadata | null>(null);

  const [trimStartSeconds, setTrimStartSeconds] = useState(0);

  const [trimEndSeconds, setTrimEndSeconds] = useState(0);

  const [trimScrubSeconds, setTrimScrubSeconds] = useState(0);

  const [isTrimPlaying, setIsTrimPlaying] = useState(false);

  const [activeTrimDrag, setActiveTrimDrag] = useState<TrimDragMode>('none');

  const [trimThumbnails, setTrimThumbnails] = useState<string[]>([]);

  const [isTrimPreparing, setIsTrimPreparing] = useState(false);

  const [trimError, setTrimError] = useState<string | null>(null);
  const { resetPreviewLayout, trimViewportRef, trimMeasureRef, trimPreviewContainerRef, trimPreviewMaxHeight } = useTrimPreviewLayout({
    isTrimOpen, isProcessing, trimError, trimSourceUrl, thumbnailCount: trimThumbnails.length,
  });
  const trimDurationSeconds = Math.max(0, trimEndSeconds - trimStartSeconds);

  const trimSliderMax = trimSourceMetadata?.duration ?? 0;

  const trimTargetCut =
    trimTargetCutIndex === null ? activeCut : (cuts[trimTargetCutIndex] ?? null);

  const trimTargetDurationSeconds = Math.max(0, trimTargetCut?.durationSeconds ?? 0);

  const recommendedTrimSeconds =
    trimTargetDurationSeconds > 0 ? trimTargetDurationSeconds : trimDurationSeconds;

  const minTrimDurationForSource = Math.min(
    MIN_TRIM_DURATION_SECONDS,
    trimSliderMax > 0 ? trimSliderMax : MIN_TRIM_DURATION_SECONDS
  );
  const pauseTrimPlayback = useCallback(() => {
    if (trimPlaybackRafRef.current !== null) {
      cancelAnimationFrame(trimPlaybackRafRef.current);
      trimPlaybackRafRef.current = null;
    }
    const previewVideo = trimPreviewVideoRef.current;
    if (previewVideo && !previewVideo.paused) {
      previewVideo.pause();
    }
    setIsTrimPlaying(false);
  }, []);

  const timelineXToSeconds = useCallback(
    (clientX: number) => {
      const timeline = trimTimelineRef.current;
      if (!timeline || trimSliderMax <= 0) return 0;
      const rect = timeline.getBoundingClientRect();
      if (rect.width <= 0) return 0;
      const progress = clampValue((clientX - rect.left) / rect.width, 0, 1);
      return progress * trimSliderMax;
    },
    [trimSliderMax]
  );

  const secondsToTimelineX = useCallback(
    (seconds: number) => {
      if (trimSliderMax <= 0) return 0;
      return clampValue((seconds / trimSliderMax) * 100, 0, 100);
    },
    [trimSliderMax]
  );

  const handleTrimPlayToggle = useCallback(async () => {
    const previewVideo = trimPreviewVideoRef.current;
    if (!previewVideo || !trimSourceMetadata) return;

    if (isTrimPlaying) {
      pauseTrimPlayback();
      return;
    }

    const startAt = clampValue(trimScrubSeconds, trimStartSeconds, trimEndSeconds);
    if (trimEndSeconds - startAt < 0.02) {
      setTrimScrubSeconds(trimEndSeconds);
      return;
    }

    try {
      previewVideo.currentTime = startAt;
      const playPromise = previewVideo.play();
      if (playPromise) {
        await playPromise;
      }
      setIsTrimPlaying(true);
      setTrimError(null);
    } catch {
      setIsTrimPlaying(false);
      setTrimError('미리보기를 재생하지 못했습니다.');
    }
  }, [
    isTrimPlaying,
    pauseTrimPlayback,
    trimEndSeconds,
    trimScrubSeconds,
    trimSourceMetadata,
    trimStartSeconds,
  ]);

  const handleTrimPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, dragMode: Exclude<TrimDragMode, 'none'>) => {
      if (trimSliderMax <= 0) return;
      event.preventDefault();
      event.stopPropagation();
      pauseTrimPlayback();
      trimDragPointerIdRef.current = event.pointerId;
      trimDragStartRef.current = {
        pointerX: event.clientX,
        startSeconds: trimStartSeconds,
        endSeconds: trimEndSeconds,
        scrubSeconds: trimScrubSeconds,
      };
      setActiveTrimDrag(dragMode);
      setTrimError(null);
    },
    [pauseTrimPlayback, trimEndSeconds, trimScrubSeconds, trimSliderMax, trimStartSeconds]
  );

  const handleTrimScrubPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (trimSliderMax <= 0) return;
      const rawSeconds = timelineXToSeconds(event.clientX);
      const currentStart = trimBoundsRef.current.start;
      const currentEnd = trimBoundsRef.current.end;
      const safeScrub = clampValue(rawSeconds, currentStart, currentEnd);
      setTrimScrubSeconds(safeScrub);
      handleTrimPointerDown(event, 'scrub');
    },
    [handleTrimPointerDown, timelineXToSeconds, trimSliderMax]
  );

  const resetTrimState = useCallback(() => {
    operationRef.current += 1;
    preparationRef.current?.abort();
    preparationRef.current = null;
    conversionRef.current?.abort();
    conversionRef.current = null;
    setIsProcessing(false);
    pauseTrimPlayback();
    trimDragPointerIdRef.current = null;
    trimDragStartRef.current = null;
    setTrimSourceFile(null);
    setTrimSourceMetadata(null);
    setTrimStartSeconds(0);
    setTrimEndSeconds(0);
    setTrimScrubSeconds(0);
    setActiveTrimDrag('none');
    setTrimThumbnails([]);
    resetPreviewLayout();
    setIsTrimPreparing(false);
    setTrimError(null);
    setTrimTargetCutIndex(null);
    setTrimSourceUrl(null);
  }, [pauseTrimPlayback, resetPreviewLayout]);

  const closeTrimModal = useCallback(() => {
    setIsTrimOpen(false);
    resetTrimState();
  }, [resetTrimState]);

  const open = useCallback(async (file: File, targetIndex: number) => {
    const targetCut = cuts[targetIndex];
    if (!targetCut || targetCut.isFixed) return;
    const operation = ++operationRef.current;
    preparationRef.current?.abort();
    const preparation = new AbortController();
    preparationRef.current = preparation;
    const objectUrl = URL.createObjectURL(file);
    setIsTrimPreparing(true);
    try {
      const metadata = await loadVideoMetadataFromUrl(objectUrl, logVideoDebug, preparation.signal);
      if (operation !== operationRef.current) { URL.revokeObjectURL(objectUrl); return; }
      if (!Number.isFinite(metadata.duration) || metadata.duration <= 0) {
        throw new Error('선택한 영상 길이를 확인하지 못했습니다.');
      }

      const targetCutDurationSeconds = Math.max(0, targetCut.durationSeconds ?? 0);
      const minTrimDurationForMetadata = Math.min(
        MIN_TRIM_DURATION_SECONDS,
        metadata.duration > 0 ? metadata.duration : MIN_TRIM_DURATION_SECONDS
      );
      const preferredDuration =
        targetCutDurationSeconds > 0
          ? Math.min(metadata.duration, targetCutDurationSeconds)
          : metadata.duration;
      const safeStart = 0;
      const safeEnd = Math.max(
        Math.min(metadata.duration, preferredDuration),
        Math.min(metadata.duration, minTrimDurationForMetadata)
      );
      setTrimSourceFile(file);
      setTrimSourceUrl(objectUrl);
      setTrimSourceMetadata(metadata);
      setTrimStartSeconds(safeStart);
      setTrimEndSeconds(safeEnd);
      setTrimScrubSeconds(safeStart);
      setActiveTrimDrag('none');
      setIsTrimPlaying(false);
      setIsTrimOpen(true);
      setTrimTargetCutIndex(targetIndex);
      setTrimError(null);

      try {
        const thumbnails = await generateTimelineThumbnails(objectUrl, metadata, preparation.signal);
        if (operation === operationRef.current) setTrimThumbnails(thumbnails);
      } catch {
        if (operation === operationRef.current) setTrimThumbnails([]);
      }
    } catch (error: unknown) {
      URL.revokeObjectURL(objectUrl);
      if (operation !== operationRef.current) return;
      const message = getErrorMessage(error, '영상을 준비하지 못했습니다.');
      setTrimError(message);
    } finally {
      if (operation === operationRef.current) setIsTrimPreparing(false);
    }
  }, [cuts, logVideoDebug]);

  const handleTrimConfirm = useCallback(async () => {
    if (!trimSourceUrl || !trimSourceMetadata) {
      setTrimError('영상 정보가 없습니다.');
      return;
    }
    const targetIndex = trimTargetCutIndex ?? activeCutIndex;
    const targetCut = cuts[targetIndex];
    if (!targetCut || targetCut.isFixed) {
      setTrimError('현재 컷에는 갤러리 영상을 적용할 수 없습니다.');
      return;
    }
    if (trimDurationSeconds < minTrimDurationForSource) {
      setTrimError('선택 구간이 너무 짧습니다.');
      return;
    }

    const operation = operationRef.current;
    const controller = new AbortController();
    conversionRef.current = controller;
    pauseTrimPlayback();
    setIsProcessing(true);
    setTrimError(null);
    try {
      const converted = await captureVideoSegmentToBlob(
        trimSourceUrl,
        trimSourceMetadata,
        trimStartSeconds,
        trimEndSeconds,
        logVideoDebug,
        controller.signal
      );
      if (operation !== operationRef.current) return;
      await onSubmit(targetIndex, converted, 'file');
      if (operation === operationRef.current) closeTrimModal();
    } catch (error: unknown) {
      if (operation !== operationRef.current || (error instanceof DOMException && error.name === 'AbortError')) return;
      const message = getErrorMessage(error, '영상 구간을 처리하지 못했습니다.');
      setTrimError(message);

    } finally {
      if (conversionRef.current === controller) conversionRef.current = null;
      if (operation === operationRef.current) setIsProcessing(false);
    }
  }, [
    activeCutIndex,
    logVideoDebug,
    closeTrimModal,
    cuts,
    minTrimDurationForSource,
    pauseTrimPlayback,
    onSubmit,
    trimDurationSeconds,
    trimEndSeconds,
    trimSourceMetadata,
    trimSourceUrl,
    trimStartSeconds,
    trimTargetCutIndex,
  ]);

  useEffect(() => {
    return () => {
      if (trimSourceUrl) {
        URL.revokeObjectURL(trimSourceUrl);
      }
    };
  }, [trimSourceUrl]);

  useEffect(() => {
    return () => {
      pauseTrimPlayback();
    };
  }, [pauseTrimPlayback]);

  useEffect(() => {
    trimBoundsRef.current = {
      start: trimStartSeconds,
      end: trimEndSeconds,
      scrub: trimScrubSeconds,
    };
  }, [trimEndSeconds, trimScrubSeconds, trimStartSeconds]);

  useEffect(() => {
    if (!isTrimOpen || !trimSourceMetadata) return;
    const maxDuration = trimSourceMetadata.duration;
    if (!Number.isFinite(maxDuration) || maxDuration <= 0) return;

    const epsilon = 0.0001;
    const safeStart = clampValue(
      trimStartSeconds,
      0,
      Math.max(0, maxDuration - minTrimDurationForSource)
    );
    const safeEnd = clampValue(
      trimEndSeconds,
      safeStart + minTrimDurationForSource,
      maxDuration
    );
    const safeScrub = clampValue(trimScrubSeconds, safeStart, safeEnd);

    if (Math.abs(safeStart - trimStartSeconds) > epsilon) {
      setTrimStartSeconds(safeStart);
    }
    if (Math.abs(safeEnd - trimEndSeconds) > epsilon) {
      setTrimEndSeconds(safeEnd);
    }
    if (Math.abs(safeScrub - trimScrubSeconds) > epsilon) {
      setTrimScrubSeconds(safeScrub);
    }
  }, [
    isTrimOpen,
    minTrimDurationForSource,
    trimEndSeconds,
    trimScrubSeconds,
    trimSourceMetadata,
    trimStartSeconds,
  ]);

  useEffect(() => {
    if (!isTrimOpen || !trimSourceUrl || isTrimPlaying) return;
    const previewVideo = trimPreviewVideoRef.current;
    if (!previewVideo) return;
    const targetSeconds = clampValue(trimScrubSeconds, trimStartSeconds, trimEndSeconds);

    const seekPreview = () => {
      if (!Number.isFinite(targetSeconds) || targetSeconds < 0) return;
      try {
        previewVideo.currentTime = targetSeconds;
      } catch {
        // iOS에서는 메타데이터 로드 직후 seek가 실패할 수 있다.
      }
    };

    if (previewVideo.readyState >= 1) {
      seekPreview();
      return;
    }

    previewVideo.addEventListener('loadedmetadata', seekPreview, { once: true });
    return () => {
      previewVideo.removeEventListener('loadedmetadata', seekPreview);
    };
  }, [isTrimOpen, isTrimPlaying, trimEndSeconds, trimScrubSeconds, trimSourceUrl, trimStartSeconds]);

  useEffect(() => {
    if (!isTrimPlaying) return;
    const previewVideo = trimPreviewVideoRef.current;
    if (!previewVideo) {
      setIsTrimPlaying(false);
      return;
    }

    const tick = () => {
      const currentSeconds = previewVideo.currentTime;
      if (Number.isFinite(currentSeconds)) {
        const safeCurrent = clampValue(currentSeconds, trimStartSeconds, trimEndSeconds);
        setTrimScrubSeconds(safeCurrent);
        if (currentSeconds >= trimEndSeconds - 0.02) {
          previewVideo.pause();
          setTrimScrubSeconds(trimEndSeconds);
          setIsTrimPlaying(false);
          trimPlaybackRafRef.current = null;
          return;
        }
      }
      trimPlaybackRafRef.current = requestAnimationFrame(tick);
    };

    trimPlaybackRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (trimPlaybackRafRef.current !== null) {
        cancelAnimationFrame(trimPlaybackRafRef.current);
        trimPlaybackRafRef.current = null;
      }
    };
  }, [isTrimPlaying, trimEndSeconds, trimStartSeconds]);

  useEffect(() => {
    if (activeTrimDrag === 'none') return;

    const handlePointerMove = (event: PointerEvent) => {
      if (trimDragPointerIdRef.current !== event.pointerId || trimSliderMax <= 0) {
        return;
      }
      const dragStart = trimDragStartRef.current;
      const timeline = trimTimelineRef.current;
      if (!dragStart || !timeline) return;
      const rect = timeline.getBoundingClientRect();
      if (rect.width <= 0) return;

      const deltaSeconds =
        ((event.clientX - dragStart.pointerX) / Math.max(1, rect.width)) * trimSliderMax;

      if (activeTrimDrag === 'start') {
        const maxStart = Math.max(0, dragStart.endSeconds - minTrimDurationForSource);
        const nextStart = clampValue(dragStart.startSeconds + deltaSeconds, 0, maxStart);
        setTrimStartSeconds(nextStart);
        setTrimScrubSeconds((prev) => clampValue(prev, nextStart, dragStart.endSeconds));
        return;
      }

      if (activeTrimDrag === 'end') {
        const minEnd = dragStart.startSeconds + minTrimDurationForSource;
        const nextEnd = clampValue(dragStart.endSeconds + deltaSeconds, minEnd, trimSliderMax);
        setTrimEndSeconds(nextEnd);
        setTrimScrubSeconds((prev) => clampValue(prev, dragStart.startSeconds, nextEnd));
        return;
      }

      if (activeTrimDrag === 'window') {
        const windowDuration = Math.max(
          minTrimDurationForSource,
          dragStart.endSeconds - dragStart.startSeconds
        );
        const maxStart = Math.max(0, trimSliderMax - windowDuration);
        const nextStart = clampValue(dragStart.startSeconds + deltaSeconds, 0, maxStart);
        const nextEnd = nextStart + windowDuration;
        const scrubOffset = dragStart.scrubSeconds - dragStart.startSeconds;
        const nextScrub = clampValue(nextStart + scrubOffset, nextStart, nextEnd);
        setTrimStartSeconds(nextStart);
        setTrimEndSeconds(nextEnd);
        setTrimScrubSeconds(nextScrub);
        return;
      }

      if (activeTrimDrag === 'scrub') {
        const nextScrub = clampValue(
          timelineXToSeconds(event.clientX),
          trimBoundsRef.current.start,
          trimBoundsRef.current.end
        );
        setTrimScrubSeconds(nextScrub);
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (trimDragPointerIdRef.current !== event.pointerId) return;
      trimDragPointerIdRef.current = null;
      trimDragStartRef.current = null;
      setActiveTrimDrag('none');
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [
    activeTrimDrag,
    minTrimDurationForSource,
    timelineXToSeconds,
    trimSliderMax,
  ]);

  useEffect(() => () => { operationRef.current += 1; preparationRef.current?.abort(); conversionRef.current?.abort(); }, []);
  const clearError = useCallback(() => setTrimError(null), []);
  return {
    open, reset: closeTrimModal, clearError,
    isTrimOpen, isTrimPreparing, isProcessing,
    trimSourceFile, trimSourceUrl, trimSourceMetadata, trimStartSeconds, trimEndSeconds,
    trimScrubSeconds, isTrimPlaying, activeTrimDrag, trimPreviewMaxHeight, trimThumbnails, trimError,
    trimDurationSeconds, trimSliderMax, recommendedTrimSeconds,
    trimViewportRef, trimMeasureRef, trimPreviewContainerRef, trimPreviewVideoRef, trimTimelineRef,
    closeTrimModal, handleTrimPlayToggle, handleTrimScrubPointerDown, handleTrimPointerDown,
    secondsToTimelineX, handleTrimConfirm,
  };
}
