import type { CaptionStyle, CaptionStyleVersion, CutDurationMode } from './types';

export const EXAMPLE_ASSETS = {
  exampleImage:
    'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80',
} as const;

export const VIDEO_ASSET_EXTENSIONS = [
  '.mp4',
  '.webm',
  '.mov',
  '.m4v',
  '.ogg',
  '.ogv',
] as const;
export const TEMPLATE_ASSET_BASE_URL =
  process.env.NEXT_PUBLIC_OCI_TEMPLATE_BASE_URL ?? '';

export const MIN_CAPTION_SCALE = 0.6;
export const MAX_CAPTION_SCALE = 2.2;
export const MIN_CAPTION_MAX_WIDTH_RATIO = 0.5;
export const MAX_CAPTION_MAX_WIDTH_RATIO = 0.95;
export const MAX_CAPTIONS_PER_CLIP = 5;
export const MAX_AUTO_CAPTION_CHUNKS_PER_CLIP = 60;
export const AUTO_CAPTION_PAUSE_SPLIT_MS = 450;
export const AUTO_CAPTION_MIN_DISPLAY_MS = 800;
export const AUTO_CAPTION_MAX_LINES = 2;
export const AUTO_CAPTION_WIDTH_SAFETY_RATIO = 0.97;
export const MIN_TRIM_DURATION_SECONDS = 0.3;
export const DEFAULT_GALLERY_CLIP_DURATION_SECONDS = 3;
export const TIMELINE_THUMBNAIL_COUNT = 10;
export const DURATION_MODE_RECOMMENDED: CutDurationMode = 'RECOMMENDED';
export const DURATION_MODE_FORCED: CutDurationMode = 'FORCED';
export const RECOMMENDED_AUTO_STOP_SECONDS = 60;
export const CAPTION_STYLE_VERSION_RENDER_V1: CaptionStyleVersion =
  'CAPTION_RENDER_V1';
export const DEFAULT_CAPTION_MAX_WIDTH_RATIO = 0.85;
export const CAPTION_RENDER_WIDTH = 1080;
export const CAPTION_RENDER_HEIGHT = 1920;
export const CAPTION_LAYOUT_REFERENCE_WIDTH = 408;
export const CAPTION_REFERENCE_TO_RENDER_SCALE =
  CAPTION_RENDER_WIDTH / CAPTION_LAYOUT_REFERENCE_WIDTH;
export const toCaptionRenderPx = (value: number) =>
  Math.round(value * CAPTION_REFERENCE_TO_RENDER_SCALE * 1000) / 1000;
export const CAPTION_BASE_FONT_SIZE_PX = toCaptionRenderPx(28);
export const CAPTION_LINE_HEIGHT = 1.25;
export const CAPTION_LINE_HEIGHT_PX =
  Math.round(CAPTION_BASE_FONT_SIZE_PX * CAPTION_LINE_HEIGHT * 1000) / 1000;
export const CAPTION_FONT_FAMILY = 'ReelstampCaptionPretendard';
export const CAPTION_FONT_WEIGHT = 600;
export const CAPTION_TEXT_COLOR = '#FFFFFF';
export const CAPTION_BOX_BACKGROUND_COLOR = '#000000';
export const CAPTION_BOX_BACKGROUND_OPACITY = 1;
export const CAPTION_BOX_PADDING_X_PX = toCaptionRenderPx(16);
export const CAPTION_BOX_PADDING_Y_PX = toCaptionRenderPx(8);
export const CAPTION_BOX_BORDER_RADIUS_PX = toCaptionRenderPx(18);
export const CAPTION_MAX_WIDTH_PX = Math.round(
  CAPTION_RENDER_WIDTH * DEFAULT_CAPTION_MAX_WIDTH_RATIO
);
export const CAPTION_SHADOW_OFFSET_Y_PX = toCaptionRenderPx(8);
export const CAPTION_SHADOW_BLUR_PX = toCaptionRenderPx(20);
export const CAPTION_SHADOW_COLOR = 'rgba(0,0,0,0.28)';
export const CAPTION_WHITE_SPACE = 'pre-wrap';
export const CAPTION_OVERFLOW_WRAP = 'break-word';
export const CAPTION_WORD_BREAK = 'normal';
export const CAPTION_LINE_BREAK = 'auto';
export const CAPTION_RESIZE_HANDLE_SIZE_PX = toCaptionRenderPx(28);
export const CAPTION_RESIZE_HANDLE_OFFSET_PX = toCaptionRenderPx(12);
export const CAPTION_RESIZE_HANDLE_FONT_SIZE_PX = toCaptionRenderPx(10);
export const CAPTION_INPUT_MIN_WIDTH_PX = toCaptionRenderPx(140);

export const PROCESSING_STATUS_TIMEOUT_MS = 5 * 60 * 1000;
export const COMPLETE_START_FAILED_ERROR_CODE = 'RS-VID-001';
export const PROCESSING_FAILED_ERROR_CODE = 'RS-VID-002';
export const PROCESSING_TIMEOUT_ERROR_CODE = 'RS-VID-003';
export const COMPLETE_START_FAILED_USER_MESSAGE =
  `영상 생성을 시작하지 못했어요. 잠시 후 다시 시도해 주세요. 문제가 계속되면 고객센터로 문의해 주세요. (코드: ${COMPLETE_START_FAILED_ERROR_CODE})`;
export const PROCESSING_FAILED_USER_MESSAGE =
  `영상 생성 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요. 문제가 계속되면 고객센터로 문의해 주세요. (코드: ${PROCESSING_FAILED_ERROR_CODE})`;
export const PROCESSING_TIMEOUT_USER_MESSAGE =
  `영상 생성이 예상보다 오래 걸리고 있어요. 잠시 후 다시 확인해 주세요. 문제가 계속되면 고객센터로 문의해 주세요. (코드: ${PROCESSING_TIMEOUT_ERROR_CODE})`;

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  xRatio: 0.5,
  yRatio: 0.12,
  scale: 1,
  boxed: true,
  styleVersion: CAPTION_STYLE_VERSION_RENDER_V1,
  maxWidthRatio: DEFAULT_CAPTION_MAX_WIDTH_RATIO,
  maxLines: null,
};

export const AUTO_CAPTION_DEFAULT_STYLE: CaptionStyle = {
  ...DEFAULT_CAPTION_STYLE,
  yRatio: 0.82,
  maxLines: AUTO_CAPTION_MAX_LINES,
  anchorY: 'BOTTOM',
};
