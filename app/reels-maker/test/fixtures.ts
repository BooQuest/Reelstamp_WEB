import { vi } from 'vitest';
import type { MakerCut, PreparedClip, ReelsMakerSessionResponse } from '../types';

export const makeCut = (overrides: Partial<MakerCut> = {}): MakerCut => ({
  id: 'template-cut-1', order: 1, durationSeconds: 3, durationMode: 'RECOMMENDED',
  label: '3초 [권장]', guideText: '', guideImageUrl: null,
  exampleImageUrl: null, exampleVideoUrl: null, defaultCaption: '',
  captureType: 'CAPTURE', fixedVideoUrl: null, fixedPreviewImageUrl: null, isFixed: false,
  ...overrides,
});
export const makeSession = (overrides: Partial<ReelsMakerSessionResponse> = {}): ReelsMakerSessionResponse => ({
  sessionId: 10, templateId: 'template', status: 'CAPTURE',
  clips: [{ clipId: 101, order: 1, durationSeconds: 3, status: 'PENDING' }],
  ...overrides,
});
export const makeClip = (): PreparedClip => ({ blob: new Blob(['video'], { type: 'video/webm' }), mimeType: 'video/webm', duration: 3 });
export const jsonResponse = (data: unknown, ok = true) => ({ ok, json: async () => data }) as Response;
export const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

export function installObjectUrls() {
  let next = 0;
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: vi.fn(() => `blob:test-${++next}`) });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: vi.fn() });
}

export function makeStream(withAudio = true) {
  const video = Object.assign(new EventTarget(), {
    readyState: 'live',
    getSettings: () => ({ width: 1080, height: 1920, deviceId: 'rear' }),
    getConstraints: () => ({}),
    getCapabilities: () => ({}),
    stop: vi.fn(),
  });
  const audio = { readyState: 'live', stop: vi.fn() };
  return {
    getVideoTracks: () => [video],
    getAudioTracks: () => withAudio ? [audio] : [],
    getTracks: () => withAudio ? [video, audio] : [video],
  } as unknown as MediaStream;
}

export class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];
  static isTypeSupported = (type: string) => type === 'video/webm';
  state = 'inactive';
  mimeType = 'video/webm';
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public stream: MediaStream, public options?: MediaRecorderOptions) {
    FakeMediaRecorder.instances.push(this);
  }
  start = vi.fn(() => { this.state = 'recording'; });
  stop = vi.fn(() => {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['recorded']) } as BlobEvent);
    this.onstop?.();
  });
}
