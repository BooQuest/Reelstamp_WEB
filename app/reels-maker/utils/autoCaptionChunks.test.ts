import { describe, expect, it } from 'vitest';
import { AUTO_CAPTION_DEFAULT_STYLE } from '../constants';
import type { CaptionItem } from '../types';
import {
  buildAutoCaptionChunks,
  isEditedAutoSpeechCaption,
  promoteAutoSpeechCaptionForEdit,
} from './autoCaptionChunks';

const measureText = (text: string) => text.length * 10;

describe('autoCaptionChunks', () => {
  it('splits by pause before width packing', () => {
    const chunks = buildAutoCaptionChunks({
      clipId: 10,
      zIndex: 3,
      style: { ...AUTO_CAPTION_DEFAULT_STYLE, maxWidthPx: 500 },
      measureText,
      words: [
        { text: '잠깐', startMs: 0, endMs: 200 },
        { text: '쉬고', startMs: 800, endMs: 1000 },
        { text: '다시', startMs: 1010, endMs: 1200 },
      ],
    });

    expect(chunks.map((chunk) => chunk.text)).toEqual(['잠깐', '쉬고 다시']);
    expect(chunks[0].id).toBe('auto-10-0-200');
    expect(chunks[0].placement.type).toBe('CLIP');
    if (chunks[0].placement.type === 'CLIP') {
      expect(chunks[0].placement.startMs).toBe(0);
      expect(chunks[0].placement.endMs).toBe(800);
    }
  });

  it('packs words into max two rendered lines', () => {
    const chunks = buildAutoCaptionChunks({
      clipId: 10,
      zIndex: 1,
      style: { ...AUTO_CAPTION_DEFAULT_STYLE, maxWidthPx: 45, boxed: false },
      measureText,
      words: [
        { text: '하나', startMs: 0, endMs: 100 },
        { text: '둘', startMs: 100, endMs: 200 },
        { text: '셋', startMs: 200, endMs: 300 },
        { text: '넷', startMs: 300, endMs: 400 },
        { text: '다섯', startMs: 400, endMs: 500 },
        { text: '여섯', startMs: 500, endMs: 600 },
      ],
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.text.split('\n').length <= 2)).toBe(true);
  });

  it('promotes edited auto caption ids to immutable edit ids', () => {
    const caption: CaptionItem = {
      id: 'auto-10-0-800',
      text: '자동 자막',
      source: 'AUTO',
      role: 'SPEECH',
      placement: { type: 'CLIP', clipId: 10, startMs: 0, endMs: 800 },
      zIndex: 1,
      style: AUTO_CAPTION_DEFAULT_STYLE,
    };

    const promoted = promoteAutoSpeechCaptionForEdit(caption);
    const promotedAgain = promoteAutoSpeechCaptionForEdit(promoted);

    expect(promoted.id).toMatch(/^auto-edit-/);
    expect(isEditedAutoSpeechCaption(promoted)).toBe(true);
    expect(promotedAgain.id).toBe(promoted.id);
  });
});
