import { describe, expect, it } from 'vitest';
import { coverCrop, moveCrop, zoomCrop, setEditDuration } from './geometry';
describe('source-based crop and length', () => {
  it.each([
    [1920, 1080],
    [1080, 1920],
    [500, 2000],
  ])('covers a 9:16 frame for %s × %s', (w, h) => {
    const crop = coverCrop(w, h);
    expect((crop.width * w) / (crop.height * h)).toBeCloseTo(9 / 16);
    expect(crop.x + crop.width).toBeLessThanOrEqual(1);
    expect(crop.y + crop.height).toBeLessThanOrEqual(1);
    expect(zoomCrop(crop, 100, w, h).width).toBeCloseTo(crop.width / 4);
    expect(zoomCrop(crop, 0.01, w, h).width).toBeCloseTo(crop.width);
    const moved = moveCrop(crop, 100, -100);
    expect(moved.x).toBeCloseTo(1 - crop.width);
    expect(moved.y).toBe(0);
  });
  it('keeps the start until the source end requires a shift', () => {
    const edit = { start: 8, duration: 1, crop: coverCrop(1080, 1920) };
    expect(setEditDuration(edit, 1.5, 10).start).toBe(8);
    expect(setEditDuration(edit, 3.4, 10).start).toBeCloseTo(6.6);
  });
  it.each([0, -1, 0.01, 0.15, 60.1, 3600, NaN, Infinity])(
    'rejects invalid duration %s',
    (duration) => {
      expect(() =>
        setEditDuration(
          { start: 0, duration: 1, crop: coverCrop(1, 1) },
          duration,
          5000,
        ),
      ).toThrow();
    },
  );
  it.each([0.1, 59.9, 60])('accepts duration %s without limiting source positions', (duration) => {
    expect(setEditDuration(
      { start: 7000, duration: 1, crop: coverCrop(1, 1) }, duration, 7200,
    )).toMatchObject({ start: 7000, duration });
  });
  it('floors short source limits and reports the actual maximum', () => {
    const edit = { start: 0, duration: 1, crop: coverCrop(1, 1) };
    expect(setEditDuration(edit, 9.9, 9.99).duration).toBe(9.9);
    expect(() => setEditDuration(edit, 10, 9.99)).toThrow('9.9초');
    expect(() => setEditDuration(edit, 60.1, 120)).toThrow('60.0초');
  });
});
