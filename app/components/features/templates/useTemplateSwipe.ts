'use client';

import { useRef, type PointerEvent, type MouseEvent } from 'react';
import { isInstagramPlaybackTriggerTarget } from '@/app/lib/ui/instagramPlaybackTrigger';

const isHorizontalSwipe = (x: number, y: number) => Math.abs(x) > 44 && Math.abs(x) > Math.abs(y) * 1.2;

export function useTemplateSwipe(onPrevious: () => void, onNext: () => void) {
  const start = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const suppressClick = useRef(false);

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    suppressClick.current = false;
    if (!event.isPrimary || event.button !== 0) return;
    const isPlaybackTrigger = isInstagramPlaybackTriggerTarget(event.target);
    if (event.target instanceof Element &&
      event.target.closest('button, a, input, [role="dialog"]') && !isPlaybackTrigger) return;

    start.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    if (!isPlaybackTrigger) event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    const origin = start.current;
    start.current = null;
    if (!origin || origin.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const x = event.clientX - origin.x;
    const y = event.clientY - origin.y;
    if (!isHorizontalSwipe(x, y)) return;
    suppressClick.current = true;
    if (x < 0) onNext();
    else onPrevious();
  };

  const onPointerCancel = (event: PointerEvent<HTMLElement>) => {
    start.current = null;
    suppressClick.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onClickCapture = (event: MouseEvent<HTMLElement>) => {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  return { onPointerDown, onPointerUp, onPointerCancel, onClickCapture };
}
