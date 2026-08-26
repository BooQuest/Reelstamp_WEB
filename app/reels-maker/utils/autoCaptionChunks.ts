import {
  AUTO_CAPTION_DEFAULT_STYLE,
  AUTO_CAPTION_MAX_LINES,
  AUTO_CAPTION_MIN_DISPLAY_MS,
  AUTO_CAPTION_PAUSE_SPLIT_MS,
  AUTO_CAPTION_WIDTH_SAFETY_RATIO,
  CAPTION_BASE_FONT_SIZE_PX,
  CAPTION_BOX_PADDING_X_PX,
  CAPTION_FONT_FAMILY,
  CAPTION_FONT_WEIGHT,
  CAPTION_MAX_WIDTH_PX,
  MAX_AUTO_CAPTION_CHUNKS_PER_CLIP,
} from '../constants';
import type { AutoCaptionWord, CaptionItem, CaptionStyle } from '../types';
import { createCaptionId } from './captions';

type NormalizedWord = {
  text: string;
  startMs: number;
  endMs: number;
};

type DraftChunk = {
  words: NormalizedWord[];
  lines: string[];
  startMs: number;
  endMs: number;
  style: CaptionStyle;
};

type BuildParams = {
  clipId: number;
  words: AutoCaptionWord[];
  style?: CaptionStyle;
  zIndex: number;
  measureText: (text: string, style: CaptionStyle) => number;
};

const SENTENCE_END_PATTERN = /[.!?。！？…]+$/;
const EDITED_AUTO_ID_PREFIX = 'auto-edit-';

const toFiniteMs = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.round(value));
};

const normalizeWords = (words: AutoCaptionWord[]): NormalizedWord[] =>
  words
    .map((word) => {
      const text = String(word.text ?? '').trim();
      const startMs = toFiniteMs(word.startMs);
      const endMs = toFiniteMs(word.endMs);
      if (!text || startMs == null || endMs == null || endMs <= startMs) {
        return null;
      }
      return { text, startMs, endMs };
    })
    .filter((word): word is NormalizedWord => word != null)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);

const shouldSplitAfter = (
  current: NormalizedWord,
  next: NormalizedWord | null
) => {
  if (SENTENCE_END_PATTERN.test(current.text)) return true;
  if (!next) return true;
  return next.startMs - current.endMs >= AUTO_CAPTION_PAUSE_SPLIT_MS;
};

const splitBySemanticBoundaries = (
  words: NormalizedWord[]
): NormalizedWord[][] => {
  const segments: NormalizedWord[][] = [];
  let current: NormalizedWord[] = [];

  words.forEach((word, index) => {
    current.push(word);
    if (shouldSplitAfter(word, words[index + 1] ?? null)) {
      segments.push(current);
      current = [];
    }
  });

  if (current.length > 0) segments.push(current);
  return segments;
};

export const createCaptionTextMeasurer = () => {
  if (typeof document === 'undefined') {
    return (text: string, style: CaptionStyle) =>
      text.length * CAPTION_BASE_FONT_SIZE_PX * style.scale * 0.56;
  }
  if (
    typeof navigator !== 'undefined' &&
    navigator.userAgent.toLowerCase().includes('jsdom')
  ) {
    return (text: string, style: CaptionStyle) =>
      text.length * CAPTION_BASE_FONT_SIZE_PX * style.scale * 0.56;
  }

  const canvas = document.createElement('canvas');
  let context: CanvasRenderingContext2D | null = null;
  try {
    context = canvas.getContext('2d');
  } catch {
    context = null;
  }
  if (!context) {
    return (text: string, style: CaptionStyle) =>
      text.length * CAPTION_BASE_FONT_SIZE_PX * style.scale * 0.56;
  }

  return (text: string, style: CaptionStyle) => {
    const fontSize = CAPTION_BASE_FONT_SIZE_PX * style.scale;
    context.font = `${CAPTION_FONT_WEIGHT} ${fontSize}px ${CAPTION_FONT_FAMILY}, sans-serif`;
    return context.measureText(text).width;
  };
};

export const waitForCaptionFontReady = async () => {
  if (typeof document === 'undefined') return;
  const fonts = document.fonts;
  if (!fonts?.ready) return;
  await fonts.ready;
};

const getAvailableTextWidth = (style: CaptionStyle) => {
  const maxWidthPx = style.maxWidthPx ?? CAPTION_MAX_WIDTH_PX;
  const boxedPadding = style.boxed === false
    ? 0
    : CAPTION_BOX_PADDING_X_PX * style.scale * 2;
  return Math.max(
    1,
    maxWidthPx * AUTO_CAPTION_WIDTH_SAFETY_RATIO - boxedPadding
  );
};

const wrapWords = (
  words: NormalizedWord[],
  style: CaptionStyle,
  measureText: (text: string, style: CaptionStyle) => number
) => {
  const maxWidth = getAvailableTextWidth(style);
  const lines: string[] = [];
  let line = '';

  words.forEach((word) => {
    const candidate = line ? `${line} ${word.text}` : word.text;
    if (!line || measureText(candidate, style) <= maxWidth) {
      line = candidate;
      return;
    }
    lines.push(line);
    line = word.text;
  });

  if (line) lines.push(line);
  return lines;
};

const withShrinkToFit = (
  chunk: DraftChunk,
  measureText: (text: string, style: CaptionStyle) => number
): DraftChunk => {
  const maxWidth = getAvailableTextWidth(chunk.style);
  const widestLine = chunk.lines.reduce(
    (max, line) => Math.max(max, measureText(line, chunk.style)),
    0
  );
  if (widestLine <= maxWidth) return chunk;

  return {
    ...chunk,
    style: {
      ...chunk.style,
      scale: Math.max(0.75, chunk.style.scale * (maxWidth / widestLine)),
    },
  };
};

const createDraftChunk = (
  words: NormalizedWord[],
  style: CaptionStyle,
  measureText: (text: string, style: CaptionStyle) => number
): DraftChunk => {
  const lines = wrapWords(words, style, measureText);
  return withShrinkToFit(
    {
      words,
      lines,
      startMs: words[0].startMs,
      endMs: words.at(-1)!.endMs,
      style,
    },
    measureText
  );
};

const packSegment = (
  words: NormalizedWord[],
  style: CaptionStyle,
  measureText: (text: string, style: CaptionStyle) => number
) => {
  const chunks: DraftChunk[] = [];
  let current: NormalizedWord[] = [];

  words.forEach((word) => {
    const candidate = [...current, word];
    const lines = wrapWords(candidate, style, measureText);
    if (current.length > 0 && lines.length > AUTO_CAPTION_MAX_LINES) {
      chunks.push(createDraftChunk(current, style, measureText));
      current = [word];
      return;
    }
    current = candidate;
  });

  if (current.length > 0) {
    chunks.push(createDraftChunk(current, style, measureText));
  }

  return chunks;
};

const mergeOrExtendShortChunks = (
  chunks: DraftChunk[],
  measureText: (text: string, style: CaptionStyle) => number
) => {
  const merged: DraftChunk[] = [];
  let index = 0;

  while (index < chunks.length) {
    const current = { ...chunks[index] };
    const next = chunks[index + 1];
    const duration = current.endMs - current.startMs;

    if (duration < AUTO_CAPTION_MIN_DISPLAY_MS && next) {
      const adjacent = next.startMs >= current.endMs;
      const candidateWords = [...current.words, ...next.words];
      const candidateLines = wrapWords(candidateWords, current.style, measureText);
      if (
        adjacent &&
        next.startMs - current.endMs <= AUTO_CAPTION_PAUSE_SPLIT_MS &&
        candidateLines.length <= AUTO_CAPTION_MAX_LINES
      ) {
        merged.push(
          withShrinkToFit(
            {
              words: candidateWords,
              lines: candidateLines,
              startMs: current.startMs,
              endMs: next.endMs,
              style: current.style,
            },
            measureText
          )
        );
        index += 2;
        continue;
      }

      current.endMs = Math.min(
        current.startMs + AUTO_CAPTION_MIN_DISPLAY_MS,
        next.startMs
      );
    } else if (duration < AUTO_CAPTION_MIN_DISPLAY_MS) {
      current.endMs = current.startMs + AUTO_CAPTION_MIN_DISPLAY_MS;
    }

    merged.push(current);
    index += 1;
  }

  return merged;
};

export const buildAutoCaptionChunks = ({
  clipId,
  words,
  style,
  zIndex,
  measureText,
}: BuildParams): CaptionItem[] => {
  const normalizedWords = normalizeWords(words);
  if (normalizedWords.length === 0) return [];

  const baseStyle: CaptionStyle = {
    ...AUTO_CAPTION_DEFAULT_STYLE,
    ...style,
    xRatio: style?.xRatio ?? AUTO_CAPTION_DEFAULT_STYLE.xRatio,
    yRatio: style?.yRatio ?? AUTO_CAPTION_DEFAULT_STYLE.yRatio,
    scale: style?.scale ?? AUTO_CAPTION_DEFAULT_STYLE.scale,
    boxed: style?.boxed ?? AUTO_CAPTION_DEFAULT_STYLE.boxed,
    maxLines: AUTO_CAPTION_MAX_LINES,
    anchorY: 'BOTTOM',
  };
  const packed = splitBySemanticBoundaries(normalizedWords)
    .flatMap((segment) => packSegment(segment, baseStyle, measureText));
  const chunks = mergeOrExtendShortChunks(packed, measureText).slice(
    0,
    MAX_AUTO_CAPTION_CHUNKS_PER_CLIP
  );

  return chunks.map((chunk, index) => ({
    id: `auto-${clipId}-${chunk.words[0].startMs}-${chunk.words.at(-1)!.endMs}`,
    text: chunk.lines.join('\n'),
    source: 'AUTO',
    role: 'SPEECH',
    placement: {
      type: 'CLIP',
      clipId,
      startMs: chunk.startMs,
      endMs: chunk.endMs,
    },
    zIndex: zIndex + index,
    style: chunk.style,
  }));
};

export const isAutoSpeechCaption = (caption: CaptionItem) =>
  caption.source === 'AUTO' && caption.role === 'SPEECH';

export const isEditedAutoSpeechCaption = (caption: CaptionItem) =>
  isAutoSpeechCaption(caption) && caption.id.startsWith(EDITED_AUTO_ID_PREFIX);

export const promoteAutoSpeechCaptionForEdit = (
  caption: CaptionItem
): CaptionItem => {
  if (!isAutoSpeechCaption(caption) || isEditedAutoSpeechCaption(caption)) {
    return caption;
  }

  return {
    ...caption,
    id: `${EDITED_AUTO_ID_PREFIX}${createCaptionId()}`,
  };
};
