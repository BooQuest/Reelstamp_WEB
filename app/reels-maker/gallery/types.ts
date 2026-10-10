import type { CaptionItem, CropRegion } from '../types';
export type { CropRegion } from '../types';

export type MediaEdit = { start: number; duration: number; crop: CropRegion };
export type MediaAsset = {
  id: string;
  name: string;
  kind: 'image' | 'video';
  contentType: string;
  duration: number | null;
  width: number;
  height: number;
  sizeBytes: number;
  downloadUrl: string;
};
export type ClipRevision = { id: string; assetId: string; edit: MediaEdit; renderMode?: 'RENDERED' | 'SOURCE_EDIT' };
export type MediaSource = {
  key: string;
  name: string;
  kind: 'image' | 'video';
  url: string;
  file?: File;
  asset?: MediaAsset;
};
export type MediaTarget = {
  sessionId: number;
  clipId: number;
  cutIndex: number;
};
export type EditorSnapshot = {
  clips: Array<{ clipId: number; revisionId: string | null }>;
  captions: CaptionItem[];
  captionsEnabled: boolean;
};
export type EditingMedia = {
  item: MediaSource;
  clipId: number;
  cutIndex: number;
  width: number;
  height: number;
  sourceDuration: number;
  edit: MediaEdit;
  isRecommended: boolean;
};
