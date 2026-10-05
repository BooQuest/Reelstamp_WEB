import type { VideoMetadata, VideoDebugLogger } from '../../types';
import { assertMediaActive, waitForMediaEvent } from './events';

export const isValidMediaDimension = (value: number) => Number.isFinite(value) && value > 0;
export const isValidMediaSize = (width: number, height: number) => isValidMediaDimension(width) && isValidMediaDimension(height);

export async function loadVideoMetadataFromUrl(
  url: string,
  logVideoDebug: VideoDebugLogger,
  signal?: AbortSignal,
): Promise<VideoMetadata> {
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.playsInline = true;
  video.muted = true;
  try {
    const ready = waitForMediaEvent(video, 'loadedmetadata', '영상 정보를 불러오지 못했습니다.', signal);
    video.src = url;
    await ready;
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    const width = video.videoWidth;
    const height = video.videoHeight;
    logVideoDebug('gallery metadata loaded', {
      duration, videoWidth: width, videoHeight: height, metadataWidth: width, metadataHeight: height,
    });
    if (!isValidMediaSize(width, height)) throw new Error('영상 해상도 정보를 확인하지 못했습니다.');
    return { duration, width, height };
  } finally {
    video.src = '';
  }
}

export async function seekVideoTo(video: HTMLVideoElement, time: number, signal?: AbortSignal) {
  assertMediaActive(signal);
  if (Math.abs(video.currentTime - time) < 0.02) return;
  const seeked = waitForMediaEvent(video, 'seeked', '영상 탐색 중 오류가 발생했습니다.', signal);
  video.currentTime = time;
  await seeked;
}
