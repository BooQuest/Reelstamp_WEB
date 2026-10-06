'use client';
import { useEffect, useState } from 'react';
import type { CaptionStyle } from '../types';
import { TEXT_COLORS, withGalleryStyle } from './captionStyle';

type Props = {
  style: CaptionStyle;
  onChange: (style: CaptionStyle) => void;
  onDone: () => void;
  onDelete: () => void;
};
type Choice = { label: string; changes: Partial<CaptionStyle> };
const TOOLS: Record<string, Choice[]> = {
  글꼴: [
    {
      label: 'Pretendard',
      changes: { fontFamily: 'ReelstampCaptionPretendard' },
    },
    {
      label: 'Noto Serif KR',
      changes: { fontFamily: 'ReelstampCaptionNotoSerif' },
    },
  ],
  스타일: [
    { label: '기본', changes: { textPreset: 'basic' } },
    { label: '굵게', changes: { textPreset: 'bold' } },
    { label: '그림자', changes: { textPreset: 'shadow' } },
  ],
  정렬: [
    { label: '왼쪽', changes: { textAlign: 'left' } },
    { label: '가운데', changes: { textAlign: 'center' } },
    { label: '오른쪽', changes: { textAlign: 'right' } },
  ],
  배경: [
    { label: '없음', changes: { boxed: false } },
    { label: '검정', changes: { boxed: true, boxBackgroundColor: '#000000' } },
    { label: '흰색', changes: { boxed: true, boxBackgroundColor: '#FFFFFF' } },
    { label: '불투명', changes: { boxBackgroundOpacity: 1 } },
    { label: '반투명', changes: { boxBackgroundOpacity: 0.5 } },
  ],
};
export default function CaptionToolbar({
  style,
  onChange,
  onDone,
  onDelete,
}: Props) {
  const [bottom, setBottom] = useState(0);
  const [tool, setTool] = useState<string>('글꼴');
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () =>
      setBottom(
        viewport
          ? Math.max(
              0,
              window.innerHeight - viewport.height - viewport.offsetTop,
            )
          : 0,
      );
    update();
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    return () => {
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
    };
  }, []);
  const normalized = withGalleryStyle(style, {});
  const change = (changes: Partial<CaptionStyle>) =>
    onChange(withGalleryStyle(style, changes));
  return (
    <div
      role="toolbar"
      aria-label="텍스트 도구"
      data-caption-toolbar
      className="fixed inset-x-0 z-[85] mx-auto w-full max-w-2xl shrink-0 space-y-2 border-t border-white/20 bg-[#182335] p-3 text-xs text-white shadow-xl md:static"
      style={{ bottom }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('button')) e.preventDefault();
      }}
    >
      <div className="flex items-center justify-between gap-1">
        {[...Object.keys(TOOLS), '색상'].map((name) => (
          <button
            type="button"
            key={name}
            aria-pressed={tool === name}
            onClick={() => setTool(name)}
            className="rounded px-2 py-2 aria-pressed:bg-white/15"
          >
            {name}
          </button>
        ))}
        <button type="button" onClick={onDelete} className="p-2 text-rose-300">
          삭제
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded bg-rose-500 p-2"
        >
          완료
        </button>
      </div>
      <div className="flex min-h-9 flex-wrap items-center justify-center gap-2">
        {tool === '색상'
          ? TEXT_COLORS.map((color) => (
              <button
                type="button"
                key={color}
                aria-label={`텍스트 색상 ${color}`}
                aria-pressed={normalized.textColor === color}
                onClick={() => change({ textColor: color })}
                className="h-7 w-7 rounded-full border-2 border-white/50 aria-pressed:ring-2 aria-pressed:ring-rose-500"
                style={{ backgroundColor: color }}
              />
            ))
          : TOOLS[tool].map((choice) => (
              <button
                type="button"
                key={choice.label}
                aria-pressed={Object.entries(choice.changes).every(
                  ([key, value]) =>
                    normalized[key as keyof CaptionStyle] === value,
                )}
                onClick={() => change(choice.changes)}
                className="rounded bg-white/5 px-3 py-2 aria-pressed:ring-1 aria-pressed:ring-rose-500"
              >
                {choice.label}
              </button>
            ))}
      </div>
    </div>
  );
}
