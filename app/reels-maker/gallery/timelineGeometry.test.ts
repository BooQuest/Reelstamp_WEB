import { expect, it } from 'vitest';
import { clampSegmentStart, timelinePosition, timelineTicks, timelineWindow } from './timelineGeometry';

it.each([.1, 3, 60])('maps %s seconds to a centered frame with source-clipped windows', (duration) => {
  expect(timelinePosition(7000, 7000, duration)).toBeCloseTo(12.5);
  expect(timelinePosition(7000 + duration, 7000, duration)).toBeCloseTo(87.5);
  expect(timelineWindow(0, duration, duration)).toEqual({ start: 0, end: duration });
  expect(timelineTicks(7000, duration, 7200).length).toBeLessThanOrEqual(6);
});
it('rounds positions and clamps to valid tenth-second boundaries', () => {
  expect(clampSegmentStart(1.26, 10, 3)).toBe(1.3);
  expect(clampSegmentStart(-100, 10, 3)).toBe(0);
  expect(clampSegmentStart(100, 9.99, 3)).toBe(6.9);
  expect(clampSegmentStart(7000, 7200, 60)).toBe(7000);
});
