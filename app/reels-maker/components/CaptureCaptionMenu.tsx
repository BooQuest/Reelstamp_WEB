'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Plus, Trash2, Type } from 'lucide-react';
import { MAX_CAPTION_SCALE, MIN_CAPTION_SCALE } from '../constants';

type Props = {
  activeCutIndex: number;
  overlayCaptionCount: number;
  maxCaptions: number;
  isBoxed: boolean;
  isAddDisabled: boolean;
  isToggleBoxDisabled: boolean;
  isDeleteDisabled: boolean;
  captionScale: number;
  isSizeDisabled: boolean;
  onAddCaption: () => void;
  onToggleBox: () => void;
  onDeleteCaption: () => void;
  onCaptionScaleChange: (scale: number) => void;
};

export default function CaptureCaptionMenu({
  activeCutIndex,
  overlayCaptionCount,
  maxCaptions,
  isBoxed,
  isAddDisabled,
  isToggleBoxDisabled,
  isDeleteDisabled,
  captionScale,
  isSizeDisabled,
  onAddCaption,
  onToggleBox,
  onDeleteCaption,
  onCaptionScaleChange,
}: Props) {
  const [openCutIndex, setOpenCutIndex] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isOpen = openCutIndex === activeCutIndex;

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && menuRef.current?.contains(target)) return;
      setOpenCutIndex(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenCutIndex(null);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const runAction = (action: () => void) => {
    action();
    setOpenCutIndex(null);
  };

  const menuItemClass =
    'flex h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-xs font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:text-white/35 disabled:hover:bg-transparent';
  const captionScalePercent = Math.round(captionScale * 100);

  return (
    <div ref={menuRef} className="relative ml-auto shrink-0">
      <button
        type="button"
        onClick={() => setOpenCutIndex((current) => (current === activeCutIndex ? null : activeCutIndex))}
        className="flex h-10 items-center justify-center gap-1.5 rounded-full border border-white/35 bg-white/15 px-3 text-[11px] font-semibold text-white shadow-lg backdrop-blur transition hover:bg-white/20"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <Type className="h-3.5 w-3.5" />
        자막 편집
        <ChevronDown className={`h-3.5 w-3.5 transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 w-52 rounded-2xl border border-white/15 bg-[#111827]/95 p-1.5 shadow-2xl backdrop-blur"
        >
          <button
            type="button"
            onClick={() => runAction(onAddCaption)}
            disabled={isAddDisabled}
            className={menuItemClass}
          >
            <Plus className="h-4 w-4 shrink-0" />
            자막 추가 {overlayCaptionCount}/{maxCaptions}
          </button>
          <button
            type="button"
            onClick={() => runAction(onToggleBox)}
            disabled={isToggleBoxDisabled}
            className={menuItemClass}
          >
            <Type className="h-4 w-4 shrink-0" />
            텍스트 박스 {isBoxed ? 'ON' : 'OFF'}
          </button>
          <div
            className={`rounded-xl px-3 py-2 text-xs font-semibold text-white ${
              isSizeDisabled ? 'opacity-35' : ''
            }`}
          >
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <Type className="h-4 w-4 shrink-0" />
                자막 크기
              </span>
              <span className="tabular-nums text-white/70">
                {captionScalePercent}%
              </span>
            </div>
            <input
              type="range"
              min={MIN_CAPTION_SCALE}
              max={MAX_CAPTION_SCALE}
              step={0.1}
              value={captionScale}
              disabled={isSizeDisabled}
              aria-label="자막 크기"
              aria-valuetext={`${captionScalePercent}%`}
              onChange={(event) => {
                const nextScale = Number(event.target.value);
                if (Number.isFinite(nextScale)) {
                  onCaptionScaleChange(nextScale);
                }
              }}
              className="block w-full accent-[#FF4D6D] disabled:cursor-not-allowed"
            />
          </div>
          <button
            type="button"
            onClick={() => runAction(onDeleteCaption)}
            disabled={isDeleteDisabled}
            className={menuItemClass}
          >
            <Trash2 className="h-4 w-4 shrink-0" />
            선택 자막 삭제
          </button>
        </div>
      )}
    </div>
  );
}
