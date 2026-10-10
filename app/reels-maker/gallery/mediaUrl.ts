export function mediaUrl(
  sessionId: number,
  kind: 'asset' | 'clip',
  id: string | number,
) {
  return `/api/reels-maker/sessions/${sessionId}/media?${kind}Id=${encodeURIComponent(id)}`;
}
