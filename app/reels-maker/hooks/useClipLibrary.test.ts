import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useClipLibrary from './useClipLibrary';
import { uploadClip } from '../services/clipUpload';
import { downloadFixedClip } from '../services/fixedClip';
import { createPosterFromClip } from '../utils/media/previews';
import { deferred, installObjectUrls, makeClip, makeCut, makeSession } from '../test/fixtures';
import type { ReelsMakerSessionResponse } from '../types';

vi.mock('../services/clipUpload', () => ({ uploadClip: vi.fn() }));
vi.mock('../services/fixedClip', () => ({ downloadFixedClip: vi.fn() }));
vi.mock('../utils/media/previews', () => ({ createPosterFromClip: vi.fn(), revokeBlobUrl: (url: string | null) => { if (url?.startsWith('blob:')) URL.revokeObjectURL(url); } }));

beforeEach(() => {
  installObjectUrls();
  vi.mocked(uploadClip).mockResolvedValue(makeSession());
  vi.mocked(createPosterFromClip).mockResolvedValue('poster');
});
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllGlobals(); });
const cuts = [makeCut(), makeCut({ order: 2, isFixed: true }), makeCut({ order: 3 })];
const options = { cuts, sessionId: 10, sessionClipMap: { 1: 101, 3: 103 } };

describe('shared clip library', () => {
  it.each(['recording', 'file'] as const)('stores %s clips through the shared upload and skips fixed cuts', async (source) => {
    const { result } = renderHook(() => useClipLibrary(options));
    await act(async () => {
      const saved = await result.current.save(0, makeClip(), source);
      expect(saved.nextCutIndex).toBe(2);
    });
    expect(uploadClip).toHaveBeenCalledWith(expect.objectContaining({ clipId: 101, sessionId: 10 }));
    expect(result.current.clipSources[0]).toBe(source);
    expect(result.current.uploadedCuts[0]).toBe(true);
    expect(result.current.clips[0]?.url).toBe('blob:test-1');
  });

  it('retains the old clip and completion state if replacement upload fails', async () => {
    const { result } = renderHook(() => useClipLibrary(options));
    await act(async () => { await result.current.save(0, makeClip(), 'recording'); });
    const previous = result.current.clips[0];
    vi.mocked(uploadClip).mockRejectedValueOnce(new Error('upload failed'));
    await act(async () => {
      await expect(result.current.save(0, makeClip(), 'file')).rejects.toThrow('upload failed');
    });
    expect(result.current.clips[0]).toBe(previous);
    expect(result.current.clipSources[0]).toBe('recording');
    expect(result.current.uploadedCuts[0]).toBe(true);
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(previous?.url);
    expect(result.current.uploadingCuts[0]).toBe(false);
  });

  it('replaces a clip only after success and releases its old preview', async () => {
    const { result, unmount } = renderHook(() => useClipLibrary(options));
    await act(async () => { await result.current.save(0, makeClip(), 'recording'); });
    await act(async () => { await result.current.save(0, makeClip(), 'file'); });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-1');
    expect(result.current.clips[0]?.url).toBe('blob:test-2');
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-2');
  });

  it('uploads even if a poster cannot be generated', async () => {
    vi.mocked(createPosterFromClip).mockRejectedValueOnce(new Error('no poster'));
    const { result } = renderHook(() => useClipLibrary(options));
    await act(async () => { await result.current.save(0, makeClip(), 'file'); });
    expect(result.current.uploadedCuts[0]).toBe(true);
    expect(result.current.clipPosters[0]).toBeUndefined();
  });

  it('discards completion arriving after the library was reset', async () => {
    const pending = deferred<ReelsMakerSessionResponse>();
    vi.mocked(uploadClip).mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useClipLibrary(options));
    let task!: Promise<unknown>;
    await act(async () => { task = result.current.save(0, makeClip(), 'file').catch((error) => error); });
    act(() => result.current.reset(cuts));
    await act(async () => {
      pending.resolve(makeSession());
      expect(await task).toMatchObject({ name: 'AbortError' });
    });
    expect(result.current.clips[0]).toBeNull();
    expect(result.current.uploadedCuts[0]).toBe(false);
  });

  it('restores upload status when a saved preview cannot download, without inventing an input source', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const { result } = renderHook(() => useClipLibrary(options));
    await act(async () => {
      await result.current.hydrate(makeSession({ clips: [{ clipId: 101, order: 1, durationSeconds: 3, status: 'UPLOADED', downloadUrl: 'https://media.test/clip' }] }), true);
    });
    expect(result.current.uploadedCuts[0]).toBe(true);
    expect(result.current.clips[0]).toBeNull();
    expect(result.current.clipSources).toEqual({});
  });

  it('loads a fixed clip once and preserves it across a full restart', async () => {
    const fixedCuts = [makeCut({ isFixed: true, fixedVideoUrl: 'https://fixed.test/clip' })];
    vi.mocked(downloadFixedClip).mockResolvedValue({ ...makeClip(), url: 'blob:fixed' });
    const { result } = renderHook(() => useClipLibrary({ ...options, cuts: fixedCuts }));
    act(() => result.current.reset(fixedCuts));
    await waitFor(() => expect(result.current.clips[0]?.url).toBe('blob:fixed'));
    act(() => result.current.reset(fixedCuts, true));
    await waitFor(() => expect(result.current.clipPosters[0]).toBe('poster'));
    expect(downloadFixedClip).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:fixed');
  });
});
