export type ExampleMedia = {
  type: 'image' | 'video';
  src: string;
};

export type GuideImageEntry = {
  url: string;
  startSecond: number | null;
};

export type ClipInfo = {
  blob: Blob;
  url: string;
  duration: number;
  mimeType: string;
};

export type RecorderStatus = 'idle' | 'recording' | 'done';
export type Stage = 'capture' | 'processing' | 'preview';
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
  subtitle?: string | null;
  thumbnailUrl?: string | null;
  embedUrl?: string | null;
  exampleReelUrls?: string[];
  tags?: string[];
  cuts: TemplateCut[];
};

export type ReelsMakerSessionClip = {
  clipId: number;
  order: number;
  durationSeconds: number;
  defaultCaption?: string | null;
  status?: string | null;
  objectKey?: string | null;
  downloadUrl?: string | null;
  contentType?: string | null;
  actualDurationSeconds?: number | null;
};

export type ReelsMakerSessionResponse = {
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

export type CaptionStyleVersion = 'WEB_BOX_V2' | 'CAPTION_RENDER_V1';

export type CaptionStyle = {
  xRatio: number;
  yRatio: number;
  scale: number;
  boxed: boolean;
  styleVersion?: CaptionStyleVersion;
  maxWidthRatio?: number;
  maxLines?: number | null;
  renderWidth?: number;
  renderHeight?: number;
  layoutWidth?: number;
  layoutHeight?: number;
  baseFontSizePx?: number;
  lineHeight?: number;
  fontFamily?: string;
  fontWeight?: number;
  fontSizePx?: number;
  lineHeightPx?: number;
  textColor?: string;
  maxWidthPx?: number;
  boxBackgroundColor?: string;
  boxBackgroundOpacity?: number;
  boxPaddingXPx?: number;
  boxPaddingYPx?: number;
  boxBorderRadiusPx?: number;
  paddingXPx?: number;
  paddingYPx?: number;
  borderRadiusPx?: number;
  shadowOffsetYPx?: number;
  shadowBlurPx?: number;
  shadowColor?: string;
  whiteSpace?: 'pre-wrap';
  overflowWrap?: 'break-word';
  wordBreak?: 'normal';
  lineBreak?: 'auto';
};

export type CaptionPlacement =
  | {
      type: 'CLIP';
      clipId: number;
    }
  | {
      type: 'TIMELINE';
      startMs: number;
      endMs: number;
    };

export type CaptionItem = {
  id: string;
  text: string;
  source: 'TEMPLATE' | 'USER';
  placement: CaptionPlacement;
  zIndex: number;
  style: CaptionStyle;
};

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

export type TrimDragMode = 'none' | 'start' | 'end' | 'window' | 'scrub';

export type TrimDragStartState = {
  pointerX: number;
  startSeconds: number;
  endSeconds: number;
  scrubSeconds: number;
};
