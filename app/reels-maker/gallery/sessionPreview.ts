import type { ClipInfo, ReelsMakerSessionResponse } from '../types';
import { mediaUrl } from './mediaUrl';
export function sessionPreview(
  session: ReelsMakerSessionResponse,
  clipId: number,
): ClipInfo | null {
  const clip = session.clips.find((c) => c.clipId === clipId);
  if (!clip?.objectKey || clip.status !== 'UPLOADED') return null;
  const revision = clip.revision;
  const asset = session.mediaAssets?.find((a) => a.id === revision?.assetId);
  const sourceEdit = revision?.renderMode === 'SOURCE_EDIT';
  const source = asset
    ? {
        key: asset.id,
        name: asset.name,
        kind: asset.kind,
        url: mediaUrl(session.sessionId, 'asset', asset.id),
        asset,
      }
    : undefined;
  return {
    url:
      sourceEdit && source
        ? source.url
        : mediaUrl(session.sessionId, 'clip', clipId),
    objectKey: clip.objectKey,
    mimeType: clip.contentType || 'video/mp4',
    duration: clip.actualDurationSeconds ?? clip.durationSeconds ?? 0,
    kind: sourceEdit ? (asset?.kind ?? 'video') : 'video',
    edit: sourceEdit ? revision.edit : undefined,
    revisionId: revision?.id,
    source,
  };
}
