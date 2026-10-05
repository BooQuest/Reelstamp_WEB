import { act, cleanup, renderHook } from '@testing-library/react';
import type { ChangeEvent } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useGalleryImport from './useGalleryImport';
import { imageToVideoBlob } from '../utils/media/imageVideo';
import { deferred, makeClip, makeCut } from '../test/fixtures';
import type { PreparedClip } from '../types';

vi.mock('../utils/media/imageVideo', () => ({ imageToVideoBlob: vi.fn() }));
const options = () => ({
  cuts: [makeCut(), makeCut({ order: 2 })], activeCutIndex: 0,
  onSelectCut: vi.fn(), onBeforePick: vi.fn(), onOpenVideo: vi.fn().mockResolvedValue(undefined),
  onSubmit: vi.fn().mockResolvedValue(undefined), logVideoDebug: vi.fn(),
});
const selectFile = (file: File) => {
  const input = document.createElement('input');
  Object.defineProperty(input, 'files', { value: [file] });
  return { target: input } as unknown as ChangeEvent<HTMLInputElement>;
};
beforeEach(() => { vi.mocked(imageToVideoBlob).mockResolvedValue(makeClip()); });
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('gallery import', () => {
  it('sends image conversion output to the originally selected cut', async () => {
    const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
    vi.stubGlobal('showOpenFilePicker', vi.fn().mockResolvedValue([{ getFile: async () => file }]));
    const props = options();
    const { result } = renderHook(() => useGalleryImport(props));
    await act(async () => { await result.current.open(1); });
    expect(props.onBeforePick).toHaveBeenCalled();
    expect(imageToVideoBlob).toHaveBeenCalledWith(file, 3, props.logVideoDebug, expect.any(AbortSignal));
    expect(props.onSubmit).toHaveBeenCalledWith(1, expect.objectContaining({ duration: 3 }), 'file');
    expect(result.current.isMediaPickerActive).toBe(false);
    expect(result.current.isGalleryProcessing).toBe(false);
  });

  it('opens video trimming without submitting the original file', async () => {
    const props = options();
    const file = new File(['video'], 'video.mp4', { type: 'video/mp4' });
    const { result } = renderHook(() => useGalleryImport(props));
    await act(async () => { await result.current.handleGalleryFileChange(selectFile(file)); });
    expect(props.onOpenVideo).toHaveBeenCalledWith(file, 0);
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('treats a native picker cancellation as a normal return', async () => {
    vi.stubGlobal('showOpenFilePicker', vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError')));
    const { result } = renderHook(() => useGalleryImport(options()));
    await act(async () => { await result.current.open(0); });
    expect(result.current.galleryError).toBeNull();
    expect(result.current.isMediaPickerActive).toBe(false);
  });

  it('releases the fallback picker after focus returns and removes pending listeners on reset', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('showOpenFilePicker', undefined);
    const remove = vi.spyOn(window, 'removeEventListener');
    const { result } = renderHook(() => useGalleryImport(options()));
    const input = document.createElement('input');
    vi.spyOn(input, 'click').mockImplementation(() => { });
    result.current.galleryFileInputRef.current = input;
    await act(async () => { await result.current.open(0); });
    expect(result.current.isMediaPickerActive).toBe(true);
    act(() => { window.dispatchEvent(new Event('focus')); vi.advanceTimersByTime(400); });
    expect(result.current.isMediaPickerActive).toBe(false);
    await act(async () => { await result.current.open(0); });
    act(() => result.current.reset());
    expect(remove).toHaveBeenCalledWith('focus', expect.any(Function));
    remove.mockRestore();
  });

  it('clears the file input so the same file can be selected again', async () => {
    const props = options();
    const { result } = renderHook(() => useGalleryImport(props));
    const event = selectFile(new File(['image'], 'photo.jpg', { type: 'image/jpeg' }));
    await act(async () => { await result.current.handleGalleryFileChange(event); });
    expect(event.target.value).toBe('');
    await act(async () => { await result.current.handleGalleryFileChange(event); });
    expect(props.onSubmit).toHaveBeenCalledTimes(2);
  });

  it('rejects unsupported files without conversion or upload', async () => {
    const props = options();
    const { result } = renderHook(() => useGalleryImport(props));
    await act(async () => { await result.current.handleGalleryFileChange(selectFile(new File(['text'], 'file.txt', { type: 'text/plain' }))); });
    expect(result.current.galleryError).toBe('사진 또는 영상 파일만 선택할 수 있습니다.');
    expect(props.onSubmit).not.toHaveBeenCalled();
    expect(imageToVideoBlob).not.toHaveBeenCalled();
  });

  it('cancels conversion and discards a late result after reset', async () => {
    const conversion = deferred<PreparedClip>();
    vi.mocked(imageToVideoBlob).mockReturnValueOnce(conversion.promise);
    const props = options();
    const { result } = renderHook(() => useGalleryImport(props));
    let task!: Promise<void>;
    act(() => { task = result.current.handleGalleryFileChange(selectFile(new File(['image'], 'photo.jpg', { type: 'image/jpeg' }))); });
    const signal = vi.mocked(imageToVideoBlob).mock.calls[0][3];
    act(() => result.current.reset());
    expect(signal?.aborted).toBe(true);
    await act(async () => { conversion.resolve(makeClip()); await task; });
    expect(props.onSubmit).not.toHaveBeenCalled();
  });
});
