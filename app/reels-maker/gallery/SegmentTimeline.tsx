'use client';
import { useUiText } from '@/app/i18n/LocaleProvider';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useId, useRef, type PointerEvent } from 'react';
import type { VideoMetadata } from '../types';
import {
  clampSegmentStart, maxSegmentStart, SELECTION_FRACTION, SELECTION_INSET,
  timelinePosition, timelineTicks, timelineWindow,
} from './timelineGeometry';
import useTimelineThumbnails from './useTimelineThumbnails';

type Props = {
  start: number;
  duration: number;
  sourceUrl: string;
  metadata: VideoMetadata;
  disabled: boolean;
  onStartChange: (start: number) => void;
};

/** Slide the source beneath a fixed selection frame; only the input changes length. */
export default function SegmentTimeline({
  start, duration, sourceUrl, metadata, disabled, onStartChange,
}: Props) {
  const t = useUiText();
  const hintId = useId();
  const thumbnails = useTimelineThumbnails(sourceUrl, metadata, start, duration);
  const maximum = maxSegmentStart(metadata.duration, duration);
  const locked = disabled || maximum === 0;
  const drag = useRef<{ pointer: number; x: number; start: number; width: number } | null>(null);
  useEffect(() => { drag.current = null; }, [locked, duration, sourceUrl]);
  const update = (value: number) => {
    const next = clampSegmentStart(value, metadata.duration, duration);
    if (next !== start) onStartChange(next);
  };
  const begin = (event: PointerEvent<HTMLDivElement>) => {
    if (locked || drag.current || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const width = event.currentTarget.getBoundingClientRect().width;
    if (!width) return;
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointer: event.pointerId, x: event.clientX, start, width };
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const initial = drag.current;
    if (!initial || initial.pointer !== event.pointerId || locked) return;
    const delta = ((event.clientX - initial.x) / (initial.width * SELECTION_FRACTION)) * duration;
    update(initial.start - delta);
  };
  const finish = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointer === event.pointerId) drag.current = null;
  };
  const position = (time: number) => timelinePosition(time, start, duration);
  const visible = timelineWindow(start, duration, metadata.duration);
  const showThumbnails = thumbnails && thumbnails.end > visible.start && thumbnails.start < visible.end;

  return (
    <div className="w-full">
      <div
        role="slider"
        aria-label={t("사용 구간 시작")}
        aria-describedby={hintId}
        aria-orientation="horizontal"
        aria-valuemin={0}
        aria-valuemax={maximum}
        aria-valuenow={start}
        aria-valuetext={`시작 ${start.toFixed(1)}초, 종료 ${(start + duration).toFixed(1)}초`}
        aria-disabled={locked}
        tabIndex={locked ? -1 : 0}
        className={`relative h-20 touch-none select-none overflow-hidden rounded bg-black/30 outline-none focus-visible:ring-2 focus-visible:ring-rose-300 ${locked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
        onPointerDown={begin}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
        onLostPointerCapture={finish}
        onKeyDown={(event) => {
          if (locked || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          update(event.key === 'Home' ? 0 : event.key === 'End' ? maximum : start + (event.key === 'ArrowRight' ? 0.1 : -0.1));
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 bg-white/10"
          style={{ left: `${position(visible.start)}%`, width: `${position(visible.end) - position(visible.start)}%` }}
        />
        {showThumbnails && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 flex"
            style={{ left: `${position(thumbnails.start)}%`, width: `${position(thumbnails.end) - position(thumbnails.start)}%` }}
          >
            {thumbnails.images.map((src, index) => (
              <img key={index} src={src} alt="" draggable={false} className="h-full min-w-0 flex-1 object-cover" />
            ))}
          </div>
        )}
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 bg-black/50" style={{ width: `${SELECTION_INSET * 100}%` }} />
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 bg-black/50" style={{ width: `${SELECTION_INSET * 100}%` }} />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          {timelineTicks(start, duration, metadata.duration).map((time) => (
            <span key={time} className="absolute bottom-0 -translate-x-1/2 border-l border-white/60 bg-black/60 px-1 text-[10px] leading-5 text-white" style={{ left: `${position(time)}%` }}>
              {t(time.toFixed(1))}s
            </span>
          ))}
        </div>
        <div
          aria-hidden="true"
          data-testid="segment-selection"
          className="pointer-events-none absolute inset-y-0 rounded border-2 border-rose-500"
          style={{ left: `${SELECTION_INSET * 100}%`, width: `${SELECTION_FRACTION * 100}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-xs text-white/70">
        <span>{t("시작 ")}{t(start.toFixed(1))}s</span>
        <span>{t("종료 ")}{t((start + duration).toFixed(1))}s</span>
      </div>
      <p id={hintId} className="mt-1 text-center text-xs text-white/60">
        {t(maximum === 0 ? '원본 전체 구간을 사용합니다' : '썸네일을 좌우로 밀어 사용할 구간을 선택하세요')}
      </p>
    </div>
  );
}
