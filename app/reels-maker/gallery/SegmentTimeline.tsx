'use client';
/* eslint-disable @next/next/no-img-element */
import { useRef, type PointerEvent } from 'react';
import { clamp, floorTenth, MAX_CLIP_SECONDS } from './geometry';

type Segment = { start: number; duration: number };
type Props = Segment & {
  sourceDuration: number;
  thumbnails: string[];
  disabled: boolean;
  onChange: (segment: Segment) => void;
};

/** Handles resize the selected interval; dragging its center preserves its length. */
export default function SegmentTimeline({
  start,
  duration,
  sourceDuration,
  thumbnails,
  disabled,
  onChange,
}: Props) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    pointer: number;
    x: number;
    start: number;
    duration: number;
    mode: 'start' | 'end' | 'move';
  } | null>(null);
  const end = start + duration;
  const maximum = floorTenth(sourceDuration);
  const update = (
    mode: 'start' | 'end' | 'move',
    value: number,
    initial: Segment = { start, duration },
  ) => {
    const rounded = Math.round(value * 10) / 10;
    if (mode === 'move')
      onChange({
        ...initial,
        start: clamp(rounded, 0, floorTenth(maximum - initial.duration)),
      });
    else if (mode === 'start') {
      const finish = initial.start + initial.duration;
      const next = clamp(
        rounded,
        Math.max(0, finish - MAX_CLIP_SECONDS),
        floorTenth(finish - 0.1),
      );
      onChange({
        start: next,
        duration: Math.round((finish - next) * 10) / 10,
      });
    } else {
      const finish = clamp(
        rounded,
        initial.start + 0.1,
        Math.min(maximum, initial.start + MAX_CLIP_SECONDS),
      );
      onChange({
        start: initial.start,
        duration: Math.round((finish - initial.start) * 10) / 10,
      });
    }
  };
  const begin = (
    event: PointerEvent<HTMLElement>,
    mode: 'start' | 'end' | 'move',
  ) => {
    if (disabled || (event.pointerType === 'mouse' && event.button !== 0))
      return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointer: event.pointerId,
      x: event.clientX,
      start,
      duration,
      mode,
    };
  };
  const move = (event: PointerEvent<HTMLElement>) => {
    const initial = drag.current;
    const width = track.current?.getBoundingClientRect().width;
    if (!initial || initial.pointer !== event.pointerId || !width || disabled)
      return;
    const delta = ((event.clientX - initial.x) / width) * sourceDuration;
    update(
      initial.mode,
      initial.start + (initial.mode === 'end' ? initial.duration : 0) + delta,
      initial,
    );
  };
  const finish = () => {
    drag.current = null;
  };
  const handle = (mode: 'start' | 'end') => (
    <button
      type="button"
      role="slider"
      aria-label={mode === 'start' ? '구간 시작' : '구간 종료'}
      aria-valuemin={mode === 'start' ? Math.max(0, end - MAX_CLIP_SECONDS) : start + 0.1}
      aria-valuemax={
        mode === 'start' ? end - 0.1 : Math.min(maximum, start + MAX_CLIP_SECONDS)
      }
      aria-valuenow={mode === 'start' ? start : end}
      aria-valuetext={`${(mode === 'start' ? start : end).toFixed(1)}초`}
      disabled={disabled}
      className={`absolute inset-y-0 z-10 w-5 cursor-ew-resize rounded bg-rose-500 touch-none ${mode === 'start' ? '-left-2.5' : '-right-2.5'}`}
      onPointerDown={(e) => begin(e, mode)}
      onPointerMove={move}
      onPointerUp={finish}
      onPointerCancel={finish}
      onKeyDown={(e) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
        e.preventDefault();
        update(
          mode,
          e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? maximum
              : (mode === 'start' ? start : end) +
                (e.key === 'ArrowRight' ? 0.1 : -0.1),
        );
      }}
    >
      <span aria-hidden="true">┃</span>
    </button>
  );
  return (
    <div className="px-3">
      <div
        ref={track}
        className="relative h-14 select-none rounded bg-white/10"
      >
        <div className="absolute inset-0 flex overflow-hidden rounded opacity-40">
          {thumbnails.map((src, i) => (
            <img
              key={i}
              src={src}
              alt=""
              draggable={false}
              className="min-w-0 flex-1 object-cover"
            />
          ))}
        </div>
        <div
          className="absolute inset-y-0 cursor-grab touch-none border-y-2 border-rose-500 bg-white/10"
          style={{
            left: `${(start / sourceDuration) * 100}%`,
            width: `${(duration / sourceDuration) * 100}%`,
          }}
          onPointerDown={(e) => begin(e, 'move')}
          onPointerMove={move}
          onPointerUp={finish}
          onPointerCancel={finish}
        >
          {handle('start')}
          {handle('end')}
        </div>
      </div>
      <div className="mt-2 flex justify-between text-xs text-white/70">
        <span>시작 {start.toFixed(1)}s</span>
        <span>종료 {end.toFixed(1)}s</span>
      </div>
    </div>
  );
}
