'use client';
import {
  useLayoutEffect,
  useRef,
  type PointerEvent,
  type WheelEvent,
} from 'react';
import type { CropRegion } from './types';
import { moveCrop, zoomCrop } from './geometry';
export default function useCropGesture(
  crop: CropRegion,
  width: number,
  height: number,
  onChange: (crop: CropRegion) => void,
) {
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const ref = useRef(crop);
  useLayoutEffect(() => {
    ref.current = crop;
  }, [crop]);
  const distance = () => {
    const p = [...pointers.current.values()];
    return p.length >= 2 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0;
  };
  return {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      const old = pointers.current.get(e.pointerId);
      if (!old) return;
      const before = distance();
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const rect = e.currentTarget.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const next =
        pointers.current.size >= 2 && before > 0
          ? zoomCrop(ref.current, distance() / before, width, height)
          : moveCrop(
              ref.current,
              (-(e.clientX - old.x) / rect.width) * ref.current.width,
              (-(e.clientY - old.y) / rect.height) * ref.current.height,
            );
      ref.current = next;
      onChange(next);
    },
    onPointerUp: (e: PointerEvent<HTMLDivElement>) => {
      pointers.current.delete(e.pointerId);
    },
    onPointerCancel: (e: PointerEvent<HTMLDivElement>) => {
      pointers.current.delete(e.pointerId);
    },
    onWheel: (e: WheelEvent<HTMLDivElement>) => {
      e.stopPropagation();
      const next = zoomCrop(
        ref.current,
        Math.exp(-e.deltaY * 0.002),
        width,
        height,
      );
      ref.current = next;
      onChange(next);
    },
  };
}
