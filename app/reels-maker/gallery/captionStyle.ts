import type { CaptionStyle } from '../types';
export const TEXT_COLORS = [
  '#FFFFFF',
  '#000000',
  '#EF4444',
  '#FACC15',
  '#22C55E',
  '#3B82F6',
  '#A855F7',
  '#EC4899',
];
export function withGalleryStyle(
  style: CaptionStyle,
  changes: Partial<CaptionStyle>,
): CaptionStyle {
  return {
    ...style,
    styleVersion: 'CAPTION_RENDER_V2',
    fontFamily: style.fontFamily || 'ReelstampCaptionPretendard',
    textColor: style.textColor || '#FFFFFF',
    textAlign: style.textAlign || 'center',
    textPreset: style.textPreset || 'basic',
    boxBackgroundColor: style.boxBackgroundColor || '#000000',
    boxBackgroundOpacity: style.boxBackgroundOpacity ?? 1,
    ...changes,
  };
}
export function captionTextStyle(style: CaptionStyle) {
  if (style.styleVersion !== 'CAPTION_RENDER_V2') return {};
  return {
    fontFamily: style.fontFamily || 'ReelstampCaptionPretendard',
    fontWeight: style.textPreset === 'bold' ? 700 : 600,
    color: style.textColor || '#FFFFFF',
    textAlign: style.textAlign || 'center',
    textShadow:
      style.textPreset === 'shadow' ? '0.04em 0.04em 0.08em #000000' : 'none',
  };
}
export function captionBackground(style: CaptionStyle) {
  const color =
    style.boxBackgroundColor === '#FFFFFF' ? '255,255,255' : '0,0,0';
  return style.boxed
    ? `rgba(${color},${style.boxBackgroundOpacity ?? 1})`
    : 'transparent';
}
