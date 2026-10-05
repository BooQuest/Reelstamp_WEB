import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useVideoTrim from './useVideoTrim';
import { loadVideoMetadataFromUrl } from '../utils/media/metadata';
import { generateTimelineThumbnails } from '../utils/media/previews';
import { captureVideoSegmentToBlob } from '../utils/media/videoSegment';
import { deferred, installObjectUrls, makeClip, makeCut } from '../test/fixtures';
import type { PreparedClip } from '../types';

vi.mock('../utils/media/metadata', () => ({ loadVideoMetadataFromUrl: vi.fn() }));
vi.mock('../utils/media/previews', () => ({ generateTimelineThumbnails: vi.fn() }));
vi.mock('../utils/media/videoSegment', () => ({ captureVideoSegmentToBlob: vi.fn() }));
const options = () => ({ cuts: [makeCut(), makeCut({ order: 2, durationSeconds: 5 })], activeCutIndex: 0, onSubmit: vi.fn().mockResolvedValue(undefined), logVideoDebug: vi.fn() });
const file = new File(['video'], 'clip.mp4', { type: 'video/mp4' });
beforeEach(() => {
  installObjectUrls();
  vi.mocked(loadVideoMetadataFromUrl).mockResolvedValue({ width: 1080, height: 1920, duration: 10 });
  vi.mocked(generateTimelineThumbnails).mockResolvedValue(['thumbnail']);
  vi.mocked(captureVideoSegmentToBlob).mockResolvedValue(makeClip());
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe('video trim', () => {
  it('uses the target cut duration and submits to that cut after the active cut changes', async () => {
    const props = options();
    const { result, rerender } = renderHook((p) => useVideoTrim(p), { initialProps: props });
    await act(async () => { await result.current.open(file, 1); });
    expect(result.current.trimEndSeconds).toBe(5);
    rerender({ ...props, activeCutIndex: 0 });
    await act(async () => { await result.current.handleTrimConfirm(); });
    expect(props.onSubmit).toHaveBeenCalledWith(1, expect.any(Object), 'file');
    expect(result.current.isTrimOpen).toBe(false);
    expect(result.current.isProcessing).toBe(false);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-1');
  });

  it('keeps the editor usable without timeline thumbnails', async () => {
    vi.mocked(generateTimelineThumbnails).mockRejectedValueOnce(new Error('thumbnail failure'));
    const { result } = renderHook(() => useVideoTrim(options()));
    await act(async () => { await result.current.open(file, 0); });
    expect(result.current.isTrimOpen).toBe(true);
    expect(result.current.trimThumbnails).toEqual([]);
  });

  it('preserves the selection when saving fails', async () => {
    const props = options();
    props.onSubmit.mockRejectedValueOnce(new Error('upload failed'));
    const { result } = renderHook(() => useVideoTrim(props));
    await act(async () => { await result.current.open(file, 0); });
    await act(async () => { await result.current.handleTrimConfirm(); });
    expect(result.current.isTrimOpen).toBe(true);
    expect(result.current.trimError).toBe('upload failed');
    expect(result.current.isProcessing).toBe(false);
  });

  it('aborts conversion when the trim editor closes and discards late output', async () => {
    const pending = deferred<PreparedClip>();
    vi.mocked(captureVideoSegmentToBlob).mockReturnValueOnce(pending.promise);
    const props = options();
    const { result } = renderHook(() => useVideoTrim(props));
    await act(async () => { await result.current.open(file, 0); });
    let task!: Promise<void>;
    act(() => { task = result.current.handleTrimConfirm(); });
    const signal = vi.mocked(captureVideoSegmentToBlob).mock.calls[0][5];
    act(() => result.current.closeTrimModal());
    expect(signal?.aborted).toBe(true);
    await act(async () => { pending.resolve(makeClip()); await task; });
    expect(props.onSubmit).not.toHaveBeenCalled();
    expect(result.current.isProcessing).toBe(false);
  });
});
