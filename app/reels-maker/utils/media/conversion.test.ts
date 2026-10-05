import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { imageToVideoBlob } from './imageVideo';
import { captureVideoSegmentToBlob } from './videoSegment';
import { createConfiguredRecorder } from './recorder';
import { FakeMediaRecorder, installObjectUrls, makeStream } from '../../test/fixtures';

let createdImage: HTMLImageElement;
let createdVideo: HTMLVideoElement;
let stream: MediaStream;
beforeEach(() => {
  installObjectUrls();
  FakeMediaRecorder.instances = [];
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
  stream = makeStream(false);
  const create = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    const element = create(tag);
    if (tag === 'img') {
      createdImage = element as HTMLImageElement;
      Object.defineProperties(element, { naturalWidth: { value: 1920 }, naturalHeight: { value: 1080 } });
    }
    if (tag === 'video') createdVideo = element as HTMLVideoElement;
    return element;
  }) as typeof document.createElement);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
  Object.defineProperty(HTMLCanvasElement.prototype, 'captureStream', { configurable: true, writable: true, value: vi.fn(() => stream) });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => { });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); delete (HTMLCanvasElement.prototype as unknown as Record<string, unknown>).captureStream; });

async function imageReady() {
  createdImage.dispatchEvent(new Event('load'));
  await Promise.resolve();
}

describe('browser media conversion ownership', () => {
  it('keeps the recorder codec preference and audio/video bitrate settings', () => {
    const configured = createConfiguredRecorder(makeStream(), 'test', vi.fn());
    expect(configured?.selectedMimeType).toBe('video/webm');
    expect(FakeMediaRecorder.instances[0].options).toEqual({ mimeType: 'video/webm', videoBitsPerSecond: 12_000_000, audioBitsPerSecond: 192_000 });
  });

  it('converts a still image at the existing duration and releases its timer, stream, and URL', async () => {
    vi.useFakeTimers();
    const pending = imageToVideoBlob(new File(['image'], 'photo.jpg'), 3, vi.fn());
    await imageReady();
    vi.advanceTimersByTime(3000);
    const result = await pending;
    expect(result).toMatchObject({ duration: 3, mimeType: 'video/webm' });
    expect(result.blob.size).toBeGreaterThan(0);
    expect(FakeMediaRecorder.instances[0].options).not.toHaveProperty('audioBitsPerSecond');
    expect(stream.getVideoTracks()[0].stop).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-1');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('releases the image URL when decoding fails', async () => {
    const pending = imageToVideoBlob(new File(['invalid'], 'photo.jpg'), 3, vi.fn());
    const rejected = expect(pending).rejects.toThrow('사진을 불러오지 못했습니다.');
    createdImage.dispatchEvent(new Event('error'));
    await rejected;
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-1');
    expect(FakeMediaRecorder.instances).toHaveLength(0);
  });

  it.each(['abort', 'error'])('stops an image recorder and clears its timer on %s', async (failure) => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const pending = imageToVideoBlob(new File(['image'], 'photo.jpg'), 30, vi.fn(), controller.signal);
    const rejected = expect(pending).rejects.toThrow();
    await imageReady();
    const recorder = FakeMediaRecorder.instances[0];
    if (failure === 'abort') controller.abort(); else recorder.onerror?.();
    await rejected;
    expect(recorder.state).toBe('inactive');
    expect(stream.getVideoTracks()[0].stop).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-1');
  });

  it('cancels video loading and clears its source before a recorder is created', async () => {
    const controller = new AbortController();
    const pending = captureVideoSegmentToBlob('blob:source', { width: 1080, height: 1920, duration: 10 }, 0, 3, vi.fn(), controller.signal);
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await rejected;
    expect(createdVideo.getAttribute('src')).toBe('');
    expect(FakeMediaRecorder.instances).toHaveLength(0);
  });
});
