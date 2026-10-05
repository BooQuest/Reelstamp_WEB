import type { WebApiResponse } from '@/app/lib/api/auth';
import type {
  PreparedClip,
  ReelsMakerClipPresignResponse,
  ReelsMakerSessionResponse,
} from '../types';

export async function uploadClip({
  sessionId,
  clipId,
  clip,
  signal,
}: {
  sessionId: number;
  clipId: number;
  clip: PreparedClip;
  signal?: AbortSignal;
}): Promise<ReelsMakerSessionResponse> {
  const response = await fetch(`/api/reels-maker/sessions/${sessionId}/clips/presign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clipId, contentType: clip.mimeType }),
    signal,
  });
  const payload: WebApiResponse<ReelsMakerClipPresignResponse> = await response.json();
  if (!response.ok || !payload?.success || !payload?.data?.uploadUrl) {
    throw new Error(payload?.message || '업로드 URL 발급에 실패했습니다.');
  }

  const uploaded = await fetch(payload.data.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': clip.mimeType },
    body: clip.blob,
    signal,
  });
  if (!uploaded.ok) throw new Error('클립 업로드에 실패했습니다.');

  const completed = await fetch(
    `/api/reels-maker/sessions/${sessionId}/clips/${clipId}/upload-complete`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        objectKey: payload.data.objectKey,
        actualDurationSeconds: clip.duration,
      }),
      signal,
    }
  );
  const result: WebApiResponse<ReelsMakerSessionResponse> = await completed.json();
  if (!completed.ok || !result?.success || !result?.data) {
    throw new Error(result?.message || '클립 업로드 완료 처리에 실패했습니다.');
  }
  return result.data;
}
