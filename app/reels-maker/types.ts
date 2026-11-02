import type { ClipRevision, MediaAsset } from './gallery/types';
export type ExampleMedia = {
  type: 'image' | 'video';
  src: string;
};

export type TemplateExampleReel = {
  url: string;
  instagramOnly?: boolean;
};

export type GuideImageEntry = {
  url: string;
  startSecond: number | null;
};

export type PreparedClip = {
  blob: Blob;
  mimeType: string;
  duration: number;
};

export type ClipSource = 'recording' | 'file';
export type VideoDebugLogger = (event: string, details?: unknown) => void;
export type SubmitClip = (index: number, clip: PreparedClip, source: ClipSource) => Promise<void>;

export type ClipInfo = Omit<PreparedClip, 'blob'> & {
  blob?: Blob;
  url: string;
  objectKey?: string | null;
  kind?: 'video' | 'image';
  edit?: import('./gallery/types').MediaEdit;
  revisionId?: string;
  source?: import('./gallery/types').MediaSource;
};

export type MakerCut = {
  id: string;
  order: number;
  durationSeconds: number;
  durationMode: CutDurationMode | null;
  label: string;
  guideText: string;
  guideImageUrl: string | null;
  exampleImageUrl: string | null;
  exampleVideoUrl: string | null;
  defaultCaption: string;
  captureType: string;
  fixedVideoUrl: string | null;
  fixedPreviewImageUrl: string | null;
  isFixed: boolean;
};

export type RecorderStatus = 'idle' | 'recording' | 'done';
export type Stage = 'capture' | 'caption-edit' | 'processing' | 'preview';
export type CutDurationMode = 'RECOMMENDED' | 'FORCED';
export type CameraFacingMode = 'environment' | 'user';

export type TemplateCut = {
  order: number;
  durationSeconds: number;
  durationMode?: string | null;
  title?: string | null;
  guideText?: string | null;
  'guide_text'?: string | null;
  guideImageUrl?: string | null;
  'guide_image_url'?: string | null;
  exampleImageUrl?: string | null;
  exampleVideoUrl?: string | null;
  defaultCaption?: string | null;
  captureType?: string | null;
  fixedVideoUrl?: string | null;
  fixedPreviewImageUrl?: string | null;
};

export type TemplateDetailResponse = {
  id: string;
  title: string;
  bgmTitle?: string | null;
  bgmUrl?: string | null;
  subtitle?: string | null;
  thumbnailUrl?: string | null;
  embedUrl?: string | null;
  instagramOnly?: boolean;
  exampleReelUrls?: string[];
  exampleReels?: TemplateExampleReel[];
  tags?: string[];
  accessType?: 'FREE' | 'PAID' | null;
  status?: 'AVAILABLE' | 'COMING_SOON' | null;
  cuts: TemplateCut[];
};

export type ReelsMakerSessionClip = {
  revision?: ClipRevision | null;
  clipId: number;
  order: number;
  durationSeconds: number;
  defaultCaption?: string | null;
  status?: string | null;
  objectKey?: string | null;
  downloadUrl?: string | null;
  contentType?: string | null;
  actualDurationSeconds?: number | null;
  fixed?: boolean;
};

export type ReelsMakerSessionResponse = {
  contentLocale?: 'ko' | 'en';
  displayStatus?: 'CAPTURE' | 'PROCESSING' | 'COMPLETED';
  newEdit?: boolean;
  mediaAssets?: MediaAsset[];
  sessionId: number;
  templateId: string;
  status: string;
  finalVideoUrl?: string | null;
  processingJobId?: string | null;
  projectName?: string | null;
  lastActiveClipOrder?: number | null;
  draftVersion?: number | null;
  lastEditedAt?: string | null;
  expiresAt?: string | null;
  draftSavingEnabled?: boolean;
  captionsEnabled?: boolean;
  autoCaptionAvailable?: boolean;
  autoCaptionRemainingAttempts?: number;
  activeAutoCaptionJobId?: string | null;
  activeAutoCaptionStatus?: string | null;
  latestAutoCaptionJobId?: string | null;
  latestAutoCaptionStatus?: string | null;
  staleAutoCaptionClipIds?: number[];
  clips: ReelsMakerSessionClip[];
  captionItems?: CaptionItem[];
};

export type ReelsMakerClipPresignResponse = {
  clipId: number;
  objectKey: string;
  uploadUrl: string;
  downloadUrl?: string | null;
  expiresAt?: string | null;
};

export type DraftSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export type ReelsMakerStatusResponse = {
  displayStatus?: 'CAPTURE' | 'PROCESSING' | 'COMPLETED';
  mediaError?: string | null;
  sessionId: number;
  status: string;
  finalVideoUrl?: string | null;
  processingJobId?: string | null;
  errorMessage?: string | null;
};

export type ReelsMakerErrorResponse = {
  success?: boolean;
  status?: number;
  message?: string;
  errorCode?: string;
  data?: unknown;
};

export type { CaptionStyleVersion, CaptionStyle, CaptionPlacement, CaptionItem, AutoCaptionClipResult, AutoCaptionUtterance, AutoCaptionWord, AutoCaptionJobResponse } from '@reelstamp/editor-core';
import type { CaptionStyle, CaptionItem } from '@reelstamp/editor-core';

export type CaptionGestureMode = 'none' | 'drag' | 'pinch' | 'resize';

export type CaptionGestureState = {
  mode: CaptionGestureMode;
  captionId: string | null;
  pointerMap: Map<number, { x: number; y: number }>;
  dragPointerId: number | null;
  startPointer: { x: number; y: number } | null;
  startStyle: CaptionStyle | null;
  startDistance: number;
  startScale: number;
};

export type VideoMetadata = {
  duration: number;
  width: number;
  height: number;
};


export type CropRegion = { x: number; y: number; width: number; height: number };
