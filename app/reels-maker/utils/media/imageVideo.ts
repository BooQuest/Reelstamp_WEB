import type { PreparedClip, VideoDebugLogger } from '../../types';
import { MIN_TRIM_DURATION_SECONDS } from '../../constants';
import { createConfiguredRecorder } from './recorder';
import { isValidMediaSize } from './metadata';
import { waitForMediaEvent } from './events';

export async function imageToVideoBlob(
  file: File,
  durationSeconds: number,
  logVideoDebug: VideoDebugLogger,
  signal?: AbortSignal,
): Promise<PreparedClip> {
  if (!window.MediaRecorder) {
    throw new Error('이 브라우저에서는 사진을 영상으로 변환할 수 없습니다.');
  }
  const objectUrl = URL.createObjectURL(file);
  const image = document.createElement('img');
  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let timer: number | null = null;
  let removeAbortListener: (() => void) | undefined;
  try {
    image.src = objectUrl;
    await waitForMediaEvent(image, 'load', '사진을 불러오지 못했습니다.', signal);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context || !canvas.captureStream) {
      throw new Error('이 브라우저에서는 사진 변환을 지원하지 않습니다.');
    }
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    logVideoDebug('image conversion dimensions', {
      naturalWidth: width, naturalHeight: height, canvasWidth: width, canvasHeight: height,
    });
    if (!isValidMediaSize(width, height)) throw new Error('사진 해상도 정보를 확인하지 못했습니다.');
    canvas.width = width;
    canvas.height = height;
    context.drawImage(image, 0, 0, width, height);
    stream = canvas.captureStream(30);
    const configured = createConfiguredRecorder(stream, 'image conversion', logVideoDebug);
    if (!configured) throw new Error('이 브라우저에서는 사진을 영상으로 변환할 수 없습니다.');
    recorder = configured.recorder;
    const { selectedMimeType } = configured;
    const activeRecorder = recorder;
    const duration = Math.max(MIN_TRIM_DURATION_SECONDS, durationSeconds);
    const chunks: BlobPart[] = [];
    const blob = await new Promise<Blob>((resolve, reject) => {
      const onAbort = () => reject(new DOMException('Image conversion cancelled', 'AbortError'));
      if (signal?.aborted) { onAbort(); return; }
      signal?.addEventListener('abort', onAbort, { once: true });
      removeAbortListener = () => signal?.removeEventListener('abort', onAbort);
      activeRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      activeRecorder.onerror = () => reject(new Error('사진 변환 중 오류가 발생했습니다.'));
      activeRecorder.onstop = () => {
        const output = new Blob(chunks, { type: activeRecorder.mimeType || selectedMimeType || 'video/webm' });
        logVideoDebug('image conversion output blob', {
          type: output.type, size: output.size, duration,
          canvasWidth: width, canvasHeight: height,
          recorderMimeType: activeRecorder.mimeType,
          recorderVideoBitsPerSecond: activeRecorder.videoBitsPerSecond,
          recorderAudioBitsPerSecond: activeRecorder.audioBitsPerSecond,
        });
        resolve(output);
      };
      activeRecorder.start();
      timer = window.setTimeout(() => activeRecorder.stop(), duration * 1000);
    });
    return { blob, mimeType: blob.type || selectedMimeType || 'video/webm', duration };
  } finally {
    removeAbortListener?.();
    if (timer !== null) window.clearTimeout(timer);
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
      if (recorder.state !== 'inactive') recorder.stop();
    }
    stream?.getTracks().forEach((track) => track.stop());
    image.src = '';
    URL.revokeObjectURL(objectUrl);
  }
}
