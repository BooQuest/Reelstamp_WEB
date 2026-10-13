import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { generateTimelineThumbnails } from '../utils/media/previews';
import useTimelineThumbnails from './useTimelineThumbnails';

vi.mock('../utils/media/previews', () => ({ generateTimelineThumbnails: vi.fn() }));
const generate = vi.mocked(generateTimelineThumbnails);
const metadata = { width: 1920, height: 1080, duration: 7200 };
beforeEach(() => { vi.useFakeTimers(); generate.mockReset(); generate.mockResolvedValue(['frame']); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
const advance = () => act(async () => { await vi.advanceTimersByTimeAsync(150); });

it('debounces movement and requests only the visible source window', async () => {
  const { result, rerender } = renderHook(({ start }) => useTimelineThumbnails('source', metadata, start, 3), { initialProps: { start: 0 } });
  rerender({ start: 100 });
  rerender({ start: 7000 });
  expect(generate).not.toHaveBeenCalled();
  await advance();
  expect(generate).toHaveBeenCalledTimes(1);
  expect(generate.mock.calls[0][3]).toEqual({ start: 6999.5, end: 7003.5 });
  expect(result.current).toMatchObject({ start: 6999.5, end: 7003.5, images: ['frame'] });
});
it('aborts obsolete requests and ignores late results after a move', async () => {
  let resolveOld!: (images: string[]) => void;
  generate.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
  const { result, rerender, unmount } = renderHook(({ start }) => useTimelineThumbnails('source', metadata, start, 3), { initialProps: { start: 1 } });
  await advance();
  const oldSignal = generate.mock.calls[0][2]!;
  rerender({ start: 5 });
  expect(oldSignal.aborted).toBe(true);
  await advance();
  expect(result.current?.start).toBe(4.5);
  await act(async () => { resolveOld(['stale']); });
  expect(result.current?.images).toEqual(['frame']);
  const activeSignal = generate.mock.calls[1][2]!;
  unmount();
  expect(activeSignal.aborted).toBe(true);
});
it('keeps the last thumbnails at their original times when a replacement fails', async () => {
  const { result, rerender } = renderHook(({ start }) => useTimelineThumbnails('source', metadata, start, 3), { initialProps: { start: 1 } });
  await advance();
  generate.mockRejectedValueOnce(new Error('decode failed'));
  rerender({ start: 2 });
  await advance();
  expect(result.current).toMatchObject({ start: .5, end: 4.5, images: ['frame'] });
});
it('hides previous-source thumbnails and cancels work when closed before the debounce', async () => {
  const { result, rerender, unmount } = renderHook(({ url }) => useTimelineThumbnails(url, metadata, 1, 3), { initialProps: { url: 'first' } });
  await advance();
  rerender({ url: 'second' });
  expect(result.current).toBeNull();
  unmount();
  await advance();
  expect(generate).toHaveBeenCalledTimes(1);
});
