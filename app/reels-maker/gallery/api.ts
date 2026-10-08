import { authFetch } from '@/app/lib/auth/browser-session';
import type { ReelsMakerSessionResponse } from '../types';
import type {
  EditorSnapshot,
  MediaAsset,
} from './types';
import { buildCaptionExportStyle } from '../utils/captions';

export class EditorConflict extends Error {}
export async function editorRequest<T>(
  path: string,
  body?: unknown,
  method = 'POST',
  signal?: AbortSignal,
): Promise<T> {
  const response = await authFetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  const payload = await response.json();
  if (response.status === 409 && payload.errorCode !== 'AUTH_ACCOUNT_CHANGED')
    throw new EditorConflict(
      '다른 작업에서 프로젝트가 변경되었습니다. 새로고침한 뒤 다시 편집해 주세요.',
    );
  if (!response.ok || !payload.success || !payload.data)
    throw new Error(payload.message || '편집 내용을 저장하지 못했습니다.');
  return payload.data as T;
}
type Upload = { id: string; uploadUrl: string; objectKey: string };
async function putFile(upload: Upload, blob: Blob, signal?: AbortSignal) {
  const response = await fetch(upload.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': blob.type },
    body: blob,
    signal,
  });
  if (!response.ok)
    throw new Error('미디어 업로드에 실패했습니다. 다시 시도해 주세요.');
}
export async function uploadOriginal(
  sessionId: number,
  file: File,
  metadata: { width: number; height: number; duration: number | null },
  signal?: AbortSignal,
) {
  const base = `/api/reels-maker/sessions/${sessionId}/media-assets`;
  const upload = await editorRequest<Upload>(
    `${base}/presign`,
    {
      name: file.name.slice(0, 255),
      kind: file.type.startsWith('image/') ? 'image' : 'video',
      contentType: file.type,
      sizeBytes: file.size,
      ...metadata,
    },
    'POST',
    signal,
  );
  await putFile(upload, file, signal);
  return editorRequest<MediaAsset>(
    `${base}/${upload.id}/upload-complete`,
    undefined,
    'POST',
    signal,
  );
}
export function applyEditorState(
  sessionId: number,
  version: number,
  snapshot: EditorSnapshot,
  signal?: AbortSignal,
) {
  return editorRequest<ReelsMakerSessionResponse>(
    `/api/reels-maker/sessions/${sessionId}/edit-state`,
    {
      version,
      clips: snapshot.clips,
      captionsEnabled: snapshot.captionsEnabled,
      captionItems: snapshot.captions
        .filter((c) => c.text.trim())
        .map((c) => ({ ...c, style: buildCaptionExportStyle(c.style) })),
    },
    'PUT',
    signal,
  );
}
