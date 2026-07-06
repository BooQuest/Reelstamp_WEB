import {
  CAPTION_BASE_FONT_SIZE_PX,
  CAPTION_BOX_BACKGROUND_COLOR,
  CAPTION_BOX_BACKGROUND_OPACITY,
  CAPTION_BOX_BORDER_RADIUS_PX,
  CAPTION_BOX_PADDING_X_PX,
  CAPTION_BOX_PADDING_Y_PX,
  CAPTION_FONT_FAMILY,
  CAPTION_FONT_WEIGHT,
  CAPTION_LINE_BREAK,
  CAPTION_LINE_HEIGHT_PX,
  CAPTION_MAX_WIDTH_PX,
  CAPTION_OVERFLOW_WRAP,
  CAPTION_RENDER_HEIGHT,
  CAPTION_RENDER_WIDTH,
  CAPTION_SHADOW_BLUR_PX,
  CAPTION_SHADOW_COLOR,
  CAPTION_SHADOW_OFFSET_Y_PX,
  CAPTION_STYLE_VERSION_RENDER_V1,
  CAPTION_TEXT_COLOR,
  CAPTION_WHITE_SPACE,
  CAPTION_WORD_BREAK,
  DEFAULT_CAPTION_MAX_WIDTH_RATIO,
  MAX_CAPTION_MAX_WIDTH_RATIO,
  MAX_CAPTION_SCALE,
  MIN_CAPTION_MAX_WIDTH_RATIO,
  MIN_CAPTION_SCALE,
} from '../constants';
import type { CaptionItem, CaptionStyle } from '../types';

export const createCaptionId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `caption-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const clampValue = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const normalizeCaptionStyle = (
  style: CaptionStyle
): CaptionStyle => ({
  xRatio: clampValue(style.xRatio, 0, 1),
  yRatio: clampValue(style.yRatio, 0, 1),
  scale: clampValue(style.scale, MIN_CAPTION_SCALE, MAX_CAPTION_SCALE),
  boxed: style.boxed !== false,
  styleVersion: CAPTION_STYLE_VERSION_RENDER_V1,
  maxWidthRatio: clampValue(
    typeof style.maxWidthRatio === 'number'
      ? style.maxWidthRatio
      : DEFAULT_CAPTION_MAX_WIDTH_RATIO,
    MIN_CAPTION_MAX_WIDTH_RATIO,
    MAX_CAPTION_MAX_WIDTH_RATIO
  ),
  maxLines:
    typeof style.maxLines === 'number' && Number.isFinite(style.maxLines)
      ? Math.max(1, Math.round(style.maxLines))
      : null,
});

export const buildCaptionExportStyle = (
  style: CaptionStyle
): CaptionStyle => {
  const normalized = normalizeCaptionStyle(style);

  return {
    ...normalized,
    renderWidth: CAPTION_RENDER_WIDTH,
    renderHeight: CAPTION_RENDER_HEIGHT,
    fontFamily: CAPTION_FONT_FAMILY,
    fontWeight: CAPTION_FONT_WEIGHT,
    fontSizePx: CAPTION_BASE_FONT_SIZE_PX,
    lineHeightPx: CAPTION_LINE_HEIGHT_PX,
    textColor: CAPTION_TEXT_COLOR,
    maxWidthPx: CAPTION_MAX_WIDTH_PX,
    boxBackgroundColor: CAPTION_BOX_BACKGROUND_COLOR,
    boxBackgroundOpacity: CAPTION_BOX_BACKGROUND_OPACITY,
    boxPaddingXPx: CAPTION_BOX_PADDING_X_PX,
    boxPaddingYPx: CAPTION_BOX_PADDING_Y_PX,
    boxBorderRadiusPx: CAPTION_BOX_BORDER_RADIUS_PX,
    paddingXPx: CAPTION_BOX_PADDING_X_PX,
    paddingYPx: CAPTION_BOX_PADDING_Y_PX,
    borderRadiusPx: CAPTION_BOX_BORDER_RADIUS_PX,
    shadowOffsetYPx: CAPTION_SHADOW_OFFSET_Y_PX,
    shadowBlurPx: CAPTION_SHADOW_BLUR_PX,
    shadowColor: CAPTION_SHADOW_COLOR,
    whiteSpace: CAPTION_WHITE_SPACE,
    overflowWrap: CAPTION_OVERFLOW_WRAP,
    wordBreak: CAPTION_WORD_BREAK,
    lineBreak: CAPTION_LINE_BREAK,
  };
};

export const buildDraftSignature = (
  projectName: string,
  activeClipOrder: number | null,
  captions: CaptionItem[],
  captionsEnabled: boolean = true
) =>
  JSON.stringify({
    projectName: projectName.trim(),
    activeClipOrder,
    captionsEnabled,
    captionItems: captions
      .filter((caption) => caption.text.trim().length > 0)
      .map((caption) => ({
        id: caption.id,
        text: caption.text,
        source: caption.source,
        role: caption.role,
        placement: caption.placement,
        zIndex: caption.zIndex,
        style: buildCaptionExportStyle(caption.style),
      })),
  });
