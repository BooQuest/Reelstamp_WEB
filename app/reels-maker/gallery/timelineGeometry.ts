import { clamp, floorTenth } from './geometry';

export const SELECTION_FRACTION = 0.75;
export const SELECTION_INSET = (1 - SELECTION_FRACTION) / 2;

export function maxSegmentStart(sourceDuration: number, duration: number) {
  return Math.max(0, floorTenth(sourceDuration - duration));
}

export function clampSegmentStart(value: number, sourceDuration: number, duration: number) {
  return clamp(Math.round(value * 10) / 10, 0, maxSegmentStart(sourceDuration, duration));
}

export function timelinePosition(time: number, start: number, duration: number) {
  return (SELECTION_INSET + ((time - start) / duration) * SELECTION_FRACTION) * 100;
}

export function timelineWindow(start: number, duration: number, sourceDuration: number) {
  const padding = (duration / SELECTION_FRACTION - duration) / 2;
  return {
    start: Math.max(0, start - padding),
    end: Math.min(sourceDuration, start + duration + padding),
  };
}

export function timelineTicks(start: number, duration: number, sourceDuration: number) {
  const window = timelineWindow(start, duration, sourceDuration);
  const step = Math.max(1, Math.round((duration * 10) / 3));
  const ticks: number[] = [];
  for (let tick = Math.ceil((window.start * 10) / step) * step; tick <= window.end * 10; tick += step) {
    ticks.push(tick / 10);
  }
  return ticks;
}
