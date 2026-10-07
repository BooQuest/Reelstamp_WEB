import type { ClipInfo, VideoMetadata } from '../../types';
import { TIMELINE_THUMBNAIL_COUNT } from '../../constants';
import { seekVideoTo } from './metadata';
import { assertMediaActive, waitForMediaEvent } from './events';

export const generateTimelineThumbnails = async (url: string, metadata: VideoMetadata, signal?: AbortSignal): Promise<string[]> => {
  const video = document.createElement('video');
  video.src = url;
  video.preload = 'auto';
  video.playsInline = true;
  video.muted = true;

  try {
    await waitForMediaEvent(video, 'loadeddata', '썸네일을 생성하지 못했습니다.', signal);

    const sourceWidth = metadata.width || video.videoWidth || 720;
    const sourceHeight = metadata.height || video.videoHeight || 1280;
    const ratio = sourceWidth / Math.max(1, sourceHeight);
    const thumbnailHeight = 72;
    const thumbnailWidth = Math.max(48, Math.round(thumbnailHeight * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = thumbnailWidth;
    canvas.height = thumbnailHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('썸네일 캔버스를 준비하지 못했습니다.');
    }

    const maxFrameCount = Math.min(
      TIMELINE_THUMBNAIL_COUNT,
      Math.max(2, Math.ceil(metadata.duration || 2))
    );
    const thumbnails: string[] = [];
    for (let i = 0; i < maxFrameCount; i += 1) {
      const progress = maxFrameCount === 1 ? 0 : i / (maxFrameCount - 1);
      const targetTime = Math.max(0, (metadata.duration || 0) * progress);
      try {
        await seekVideoTo(video, targetTime, signal);
      } catch {
        assertMediaActive(signal);
        // iOS 일부 환경에서 마지막 seek가 실패할 수 있어 가능한 프레임만 사용한다.
      }
      context.clearRect(0, 0, thumbnailWidth, thumbnailHeight);
      context.drawImage(video, 0, 0, thumbnailWidth, thumbnailHeight);
      thumbnails.push(canvas.toDataURL('image/jpeg', 0.78));
    }

    return thumbnails;
  } finally { video.src = ''; }
};

export async function createPosterFromClip(clip: ClipInfo, signal?: AbortSignal) {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  const url = URL.createObjectURL(clip.blob);
  try {
    const ready = waitForMediaEvent(video, 'loadeddata', '포스터 생성 실패', signal);
    video.src = url;
    video.load();
    await ready;
    const width = video.videoWidth || 720;
    const height = video.videoHeight || 1280;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('포스터 생성 실패');
    canvas.width = width;
    canvas.height = height;
    context.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.92);
  } finally {
    video.src = '';
    URL.revokeObjectURL(url);
  }
}

export async function ensureVideoPlayable(blob: Blob, signal?: AbortSignal) {
  const url = URL.createObjectURL(blob);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  try {
    const ready = waitForMediaEvent(video, 'loadeddata', '영상 코덱을 지원하지 않습니다.', signal);
    video.src = url;
    video.load();
    await ready;
  } finally {
    video.src = '';
    URL.revokeObjectURL(url);
  }
}

export const revokeBlobUrl = (url: string | null) => {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
};
