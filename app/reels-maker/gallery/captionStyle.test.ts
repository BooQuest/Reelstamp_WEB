import { describe, expect, it } from 'vitest';
import {
  captionTextStyle,
  withGalleryStyle,
  resolveCaptionFontWeight,
} from '@reelstamp/editor-core';
import { buildCaptionExportStyle } from '@reelstamp/editor-core';
import { DEFAULT_CAPTION_STYLE } from '@reelstamp/editor-core';

describe('caption style compatibility', () => {
  it('preserves the visible legacy style without mutating stored data', () => {
    const legacy = {
      ...DEFAULT_CAPTION_STYLE,
      textAlign: 'left' as const,
      fontWeight: 400,
    };
    const before = structuredClone(legacy);
    expect(captionTextStyle(legacy)).toMatchObject({
      textAlign: 'center',
      fontWeight: 600,
    });
    expect(withGalleryStyle(legacy, {})).toMatchObject({
      textAlign: 'center',
      fontWeight: 600,
    });
    expect(buildCaptionExportStyle(legacy)).toMatchObject({
      textAlign: 'center',
      fontWeight: 600,
    });
    expect(legacy).toEqual(before);
  });
  it.each(['left', 'center', 'right'] as const)(
    'retains explicit V2 %s alignment and saved weight',
    (textAlign) => {
      const style = {
        ...DEFAULT_CAPTION_STYLE,
        styleVersion: 'CAPTION_RENDER_V2' as const,
        textAlign,
        fontWeight: 500,
      };
      expect(captionTextStyle(style)).toMatchObject({
        textAlign,
        fontWeight: 500,
      });
      expect(buildCaptionExportStyle(style)).toMatchObject({
        textAlign,
        fontWeight: 500,
      });
    },
  );
  it.each([
    ['basic', 400],
    ['bold', 700],
    ['shadow', 600],
  ] as const)('explicit %s selection exports %i', (textPreset, fontWeight) => {
    const style = withGalleryStyle(DEFAULT_CAPTION_STYLE, { textPreset });
    expect(captionTextStyle(style).fontWeight).toBe(fontWeight);
    expect(buildCaptionExportStyle(style).fontWeight).toBe(fontWeight);
    expect(withGalleryStyle(style, { textAlign: 'right' }).fontWeight).toBe(
      fontWeight,
    );
  });
  it('keeps older basic at 600 until the user chooses Basic', () => {
    const old = {
      ...DEFAULT_CAPTION_STYLE,
      styleVersion: 'CAPTION_RENDER_V2' as const,
      textPreset: 'basic' as const,
    };
    expect(resolveCaptionFontWeight(old)).toBe(600);
    expect(withGalleryStyle(old, { textColor: '#EF4444' }).fontWeight).toBe(
      600,
    );
    expect(withGalleryStyle(old, { textPreset: 'basic' }).fontWeight).toBe(400);
    expect(resolveCaptionFontWeight({ ...old, textPreset: 'bold' })).toBe(700);
  });
});
