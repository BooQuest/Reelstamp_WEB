'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { clampValue } from '../utils/captions';

type Options = {
  isTrimOpen: boolean;
  isProcessing: boolean;
  trimError: string | null;
  trimSourceUrl: string | null;
  thumbnailCount: number;
};

export default function useTrimPreviewLayout({ isTrimOpen, isProcessing, trimError, trimSourceUrl, thumbnailCount }: Options) {
  const trimViewportRef = useRef<HTMLDivElement | null>(null);
  const trimMeasureRef = useRef<HTMLDivElement | null>(null);
  const trimPreviewContainerRef = useRef<HTMLDivElement | null>(null);
  const [trimPreviewMaxHeight, setTrimPreviewMaxHeight] = useState<number | null>(null);
  useEffect(() => {
    if (!isTrimOpen) {
      return;
    }

    let frameId: number | null = null;

    const recalculateTrimPreviewHeight = () => {
      frameId = null;
      const viewport = trimViewportRef.current;
      const measure = trimMeasureRef.current;
      const previewContainer = trimPreviewContainerRef.current;
      if (!viewport || !measure || !previewContainer) return;

      let viewportHeight = viewport.clientHeight || window.innerHeight;
      const visualViewportHeight = window.visualViewport?.height;
      if (typeof visualViewportHeight === 'number' && Number.isFinite(visualViewportHeight)) {
        viewportHeight = Math.min(viewportHeight, visualViewportHeight);
      }

      const previewAvailableWidth =
        previewContainer.parentElement?.clientWidth || Math.max(0, measure.clientWidth - 32);
      const naturalPreviewHeight = previewAvailableWidth * (16 / 9);
      const previewHeight = previewContainer.getBoundingClientRect().height || naturalPreviewHeight;
      const fixedContentHeight = Math.max(0, measure.scrollHeight - previewHeight);
      const availablePreviewHeight = viewportHeight - 16 - fixedContentHeight;
      const nextPreviewHeight = Math.floor(
        clampValue(availablePreviewHeight, 140, naturalPreviewHeight)
      );

      setTrimPreviewMaxHeight((prev) =>
        prev !== null && Math.abs(prev - nextPreviewHeight) < 1 ? prev : nextPreviewHeight
      );
    };

    const scheduleRecalculate = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      frameId = window.requestAnimationFrame(recalculateTrimPreviewHeight);
    };

    scheduleRecalculate();
    const settleTimeoutId = window.setTimeout(scheduleRecalculate, 80);
    const lateSettleTimeoutId = window.setTimeout(scheduleRecalculate, 240);
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(scheduleRecalculate) : null;
    const observedViewport = trimViewportRef.current;
    const observedMeasure = trimMeasureRef.current;

    if (resizeObserver && observedViewport && observedMeasure) {
      resizeObserver.observe(observedViewport);
      resizeObserver.observe(observedMeasure);
    }

    const visualViewport = window.visualViewport;
    window.addEventListener('resize', scheduleRecalculate);
    window.addEventListener('orientationchange', scheduleRecalculate);
    visualViewport?.addEventListener('resize', scheduleRecalculate);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      window.clearTimeout(settleTimeoutId);
      window.clearTimeout(lateSettleTimeoutId);
      window.removeEventListener('resize', scheduleRecalculate);
      window.removeEventListener('orientationchange', scheduleRecalculate);
      visualViewport?.removeEventListener('resize', scheduleRecalculate);
      resizeObserver?.disconnect();
    };
  }, [
    isProcessing,
    isTrimOpen,
    trimError,
    trimSourceUrl,
    thumbnailCount,
  ]);
  const resetPreviewLayout = useCallback(() => setTrimPreviewMaxHeight(null), []);
  return { resetPreviewLayout, trimViewportRef, trimMeasureRef, trimPreviewContainerRef, trimPreviewMaxHeight };
}
