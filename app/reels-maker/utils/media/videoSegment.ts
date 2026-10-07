import type { CropRegion } from '../../types';
import type { PreparedClip, VideoDebugLogger, VideoMetadata } from '../../types';
import { waitForMediaEvent } from './events';
import { MIN_TRIM_DURATION_SECONDS } from '../../constants';
import { createConfiguredRecorder } from './recorder';
import { isValidMediaSize, isValidMediaDimension, seekVideoTo } from './metadata';

export const captureVideoSegmentToBlob = async (
  sourceUrl: string,
  metadata: VideoMetadata,
  startSeconds: number,
  endSeconds: number,
  logVideoDebug: VideoDebugLogger,
  signal?: AbortSignal,
  crop?: CropRegion,
): Promise<PreparedClip> => {
  const duration = Math.max(crop ? 0.1 : MIN_TRIM_DURATION_SECONDS, endSeconds - startSeconds);

  const video = document.createElement('video');
  video.src = sourceUrl;
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';
  video.playsInline = true;
  video.muted = false;

  let captureStream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let audioDestination: MediaStreamAudioDestinationNode | null = null;
  let activeRecorder: MediaRecorder | null = null;
  let rafId = 0;
  let endRafId = 0;
  let frameCallbackId = 0;
  let removeAbortListener: (() => void) | undefined;
  let finished = false;
  try {
    await waitForMediaEvent(video, 'loadeddata', '영상을 불러오지 못했습니다.', signal);

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context || !canvas.captureStream || !window.MediaRecorder) {
      throw new Error('이 브라우저에서는 영상 구간 편집을 지원하지 않습니다.');
    }

    const width = isValidMediaDimension(metadata.width)
      ? metadata.width
      : video.videoWidth;
    const height = isValidMediaDimension(metadata.height)
      ? metadata.height
      : video.videoHeight;
    logVideoDebug('gallery trim dimensions', {
      metadataWidth: metadata.width,
      metadataHeight: metadata.height,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      canvasWidth: width,
      canvasHeight: height,
      startSeconds,
      endSeconds,
    });
    if (!isValidMediaSize(width, height)) {
      throw new Error('영상 해상도 정보를 확인하지 못했습니다.');
    }
    canvas.width = crop ? 1080 : width;
    canvas.height = crop ? 1920 : height;

    captureStream = canvas.captureStream(30);
    const AudioContextClass =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    audioContext = AudioContextClass ? new AudioContextClass() : null;
    if (audioContext) {
      try {
        await audioContext.resume();
        const audioSource = audioContext.createMediaElementSource(video);
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 0;
        audioDestination = audioContext.createMediaStreamDestination();
        audioSource.connect(audioDestination);
        audioSource.connect(gainNode);
        gainNode.connect(audioContext.destination);
      } catch {
        audioDestination?.stream.getTracks().forEach((track) => track.stop());
        audioDestination = null;
      }
    }

    const combinedStream = new MediaStream([
      ...captureStream.getVideoTracks(),
      ...(audioDestination?.stream.getAudioTracks() ?? []),
    ]);

    const configuredRecorder = createConfiguredRecorder(combinedStream, 'gallery trim', logVideoDebug);
    if (!configuredRecorder) {
      throw new Error('이 브라우저에서는 영상 구간 편집을 지원하지 않습니다.');
    }
    const { recorder, selectedMimeType } = configuredRecorder;
    activeRecorder = recorder;
    const chunks: BlobPart[] = [];

    const outputBlob = await new Promise<Blob>((resolve, reject) => {
      const onAbort = () => reject(new DOMException('Video conversion cancelled', 'AbortError'));
      if (signal?.aborted) { onAbort(); return; }
      signal?.addEventListener('abort', onAbort, { once: true });
      removeAbortListener = () => signal?.removeEventListener('abort', onAbort);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      recorder.onerror = () => reject(new Error('영상 구간 처리 중 오류가 발생했습니다.'));
      recorder.onstop = () => {
        const blob = new Blob(chunks, {
          type: recorder.mimeType || selectedMimeType || 'video/webm',
        });
        logVideoDebug('gallery trim output blob', {
          type: blob.type,
          size: blob.size,
          duration,
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
          recorderMimeType: recorder.mimeType,
          recorderVideoBitsPerSecond: recorder.videoBitsPerSecond,
          recorderAudioBitsPerSecond: recorder.audioBitsPerSecond,
        });
        if (!blob.size) { reject(new Error('영상 구간을 변환하지 못했습니다. 다시 시도해 주세요.')); return; }
        resolve(blob);
      };

      const videoWithFrameCallback = video as HTMLVideoElement & {
        requestVideoFrameCallback?: (callback: () => void) => number;
        cancelVideoFrameCallback?: (handle: number) => void;
      };
      const drawFrame = () => {
        if (finished) return;
        if (video.readyState >= 2) {
          if (crop) context.drawImage(video, crop.x * width, crop.y * height, crop.width * width, crop.height * height, 0, 0, canvas.width, canvas.height);
          else context.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
        if (crop) {
          // Keep publishing the final frame while a short source interval is paused.
          rafId = requestAnimationFrame(drawFrame);
        } else if (!video.ended) {
          if (videoWithFrameCallback.requestVideoFrameCallback) {
            frameCallbackId = videoWithFrameCallback.requestVideoFrameCallback(drawFrame);
          } else {
            rafId = requestAnimationFrame(drawFrame);
          }
        }
      };

      const record = async () => {
        try {
          await seekVideoTo(video, Math.max(0, startSeconds), signal);
          if (finished || signal?.aborted) return;
          // Seed the canvas before capture starts, including sub-second selections.
          if (crop) context.drawImage(video, crop.x * width, crop.y * height, crop.width * width, crop.height * height, 0, 0, canvas.width, canvas.height);
          else context.drawImage(video, 0, 0, canvas.width, canvas.height);
          // Let the captured canvas publish its initial frame before starting the recorder.
          // Otherwise very short selections may finish before the video track emits anything.
          await new Promise<void>((resolveFrame) => {
            rafId = requestAnimationFrame(() => {
              rafId = requestAnimationFrame(() => resolveFrame());
            });
          });
          if (finished || signal?.aborted) return;
          let recordingStartedAt: number | null = null;
          recorder.onstart = () => { recordingStartedAt = performance.now(); };
          recorder.start();
          drawFrame();

          video.currentTime = Math.max(0, startSeconds);
          const playing = waitForMediaEvent(video, 'playing', '영상 재생에 실패했습니다.', signal);
          const playPromise = video.play();
          if (playPromise) playPromise.catch(() => video.dispatchEvent(new Event('error')));
          await playing;
          if (finished || signal?.aborted) return;

          await new Promise<void>((resolveEnd) => {
            const checkTime = () => {
              if (finished || signal?.aborted) { resolveEnd(); return; }
              if (video.currentTime >= endSeconds || video.ended) {
                video.pause();
                if (recordingStartedAt !== null && performance.now() - recordingStartedAt >= duration * 1000) {
                  resolveEnd();
                  return;
                }
              }
              endRafId = requestAnimationFrame(checkTime);
            };
            checkTime();
          });
          if (finished || signal?.aborted) return;
          video.pause();
          if (rafId) cancelAnimationFrame(rafId);
          if (frameCallbackId && videoWithFrameCallback.cancelVideoFrameCallback) {
            videoWithFrameCallback.cancelVideoFrameCallback(frameCallbackId);
          }
          recorder.stop();
        } catch (error) {
          if (recorder.state !== 'inactive') {
            recorder.stop();
          }
          reject(error);
        }
      };
      void record();
    });

    return {
      blob: outputBlob,
      mimeType: outputBlob.type || selectedMimeType || 'video/webm',
      duration,
    };
  } finally {
    finished = true;
    removeAbortListener?.();
    video.pause();
    if (rafId) cancelAnimationFrame(rafId);
    if (endRafId) cancelAnimationFrame(endRafId);
    if (frameCallbackId && video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(frameCallbackId);
    if (activeRecorder) {
      activeRecorder.onstart = null;
      activeRecorder.ondataavailable = null;
      activeRecorder.onstop = null;
      activeRecorder.onerror = null;
      if (activeRecorder.state !== 'inactive') activeRecorder.stop();
    }
    captureStream?.getTracks().forEach((track) => track.stop());
    audioDestination?.stream.getTracks().forEach((track) => track.stop());
    if (audioContext) void audioContext.close().catch(() => undefined);
    video.src = '';
  }
};
