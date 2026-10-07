import type { ClipInfo } from '../types';
import { ensureVideoPlayable } from '../utils/media/previews';

export const downloadFixedClip = async (url: string, durationSeconds: number, signal?: AbortSignal): Promise<ClipInfo> => {
  const fixedUrl = url;
  let requestUrl = fixedUrl;
  try {
    const parsed = new URL(fixedUrl);
    parsed.searchParams.set('v', Date.now().toString());
    requestUrl = parsed.toString();
  } catch {
    requestUrl = fixedUrl;
  }
  const response = await fetch(requestUrl, { cache: 'no-store', signal });
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.message || '고정 영상을 불러오지 못했습니다.');
  }
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (contentType.includes('text/html')) {
    throw new Error('고정 영상 링크가 올바르지 않습니다. 직접 다운로드 링크를 확인해주세요.');
  }
  const blob = await response.blob();
  if (blob.type.toLowerCase().includes('text/html')) {
    throw new Error('고정 영상 링크가 올바르지 않습니다. 직접 다운로드 링크를 확인해주세요.');
  }
  if (!blob.size) {
    throw new Error('고정 영상 파일이 비어 있습니다.');
  }
  const mimeType = blob.type || 'video/mp4';
  await ensureVideoPlayable(blob, signal);
  const objectUrl = URL.createObjectURL(blob);
  return {
    blob,
    url: objectUrl,
    duration: durationSeconds,
    mimeType,
  };
};
