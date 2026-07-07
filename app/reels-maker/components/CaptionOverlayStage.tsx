'use client';

import type {
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
} from 'react';
import {
  CAPTION_BASE_FONT_SIZE_PX,
  CAPTION_BOX_BACKGROUND_OPACITY,
  CAPTION_BOX_BORDER_RADIUS_PX,
  CAPTION_BOX_PADDING_X_PX,
  CAPTION_BOX_PADDING_Y_PX,
  CAPTION_FONT_FAMILY,
  CAPTION_FONT_WEIGHT,
  CAPTION_INPUT_MIN_WIDTH_PX,
  CAPTION_LINE_BREAK,
  CAPTION_LINE_HEIGHT_PX,
  CAPTION_MAX_WIDTH_PX,
  CAPTION_OVERFLOW_WRAP,
  CAPTION_RENDER_HEIGHT,
  CAPTION_RENDER_WIDTH,
  CAPTION_RESIZE_HANDLE_FONT_SIZE_PX,
  CAPTION_RESIZE_HANDLE_OFFSET_PX,
  CAPTION_RESIZE_HANDLE_SIZE_PX,
  CAPTION_SHADOW_BLUR_PX,
  CAPTION_SHADOW_COLOR,
  CAPTION_SHADOW_OFFSET_Y_PX,
  CAPTION_TEXT_COLOR,
  CAPTION_WHITE_SPACE,
  CAPTION_WORD_BREAK,
} from '../constants';
import type { CaptionItem } from '../types';

type Props = {
  captions: CaptionItem[];
  selectedCaptionId: string | null;
  editingCaptionId: string | null;
  previewScale: number;
  stageRef: MutableRefObject<HTMLDivElement | null>;
  overlayRef: MutableRefObject<HTMLDivElement | null>;
  inputRef: MutableRefObject<HTMLInputElement | null>;
  readOnly?: boolean;
  onSelect: (captionId: string) => void;
  onEdit: (captionId: string | null) => void;
  onTextChange: (value: string) => void;
  onCaptionPointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    caption: CaptionItem
  ) => void;
  onCaptionPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onCaptionPointerEnd: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizePointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onResizePointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onResizePointerEnd: (event: ReactPointerEvent<HTMLButtonElement>) => void;
};

export default function CaptionOverlayStage({
  captions,
  selectedCaptionId,
  editingCaptionId,
  previewScale,
  stageRef,
  overlayRef,
  inputRef,
  readOnly = false,
  onSelect,
  onEdit,
  onTextChange,
  onCaptionPointerDown,
  onCaptionPointerMove,
  onCaptionPointerEnd,
  onResizePointerDown,
  onResizePointerMove,
  onResizePointerEnd,
}: Props) {
  return (
    <div
      ref={stageRef}
      className="pointer-events-none absolute left-1/2 top-1/2 z-20"
      style={{
        width: `${CAPTION_RENDER_WIDTH}px`,
        height: `${CAPTION_RENDER_HEIGHT}px`,
        transform: `translate(-50%, -50%) scale(${previewScale})`,
        transformOrigin: 'center center',
      }}
    >
      {captions.map((caption) => {
        const isSelected = caption.id === selectedCaptionId;
        const isEditing = !readOnly && caption.id === editingCaptionId;
        const hasText = caption.text.trim().length > 0;
        const style = caption.style;
        const anchorTransform =
          style.anchorY === 'BOTTOM'
            ? 'translate(-50%, -100%)'
            : 'translate(-50%, -50%)';

        return (
          <div
            key={caption.id}
            ref={isSelected ? overlayRef : undefined}
            onClick={(event) => {
              event.stopPropagation();
              if (readOnly) return;
              if (isSelected) onEdit(caption.id);
              else {
                onSelect(caption.id);
                onEdit(null);
              }
            }}
            onPointerDown={(event) => {
              if (!readOnly) onCaptionPointerDown(event, caption);
            }}
            onPointerMove={(event) => {
              if (!readOnly) onCaptionPointerMove(event);
            }}
            onPointerUp={(event) => {
              if (!readOnly) onCaptionPointerEnd(event);
            }}
            onPointerCancel={(event) => {
              if (!readOnly) onCaptionPointerEnd(event);
            }}
            className="pointer-events-auto absolute select-none"
            style={{
              left: `${style.xRatio * CAPTION_RENDER_WIDTH}px`,
              top: `${style.yRatio * CAPTION_RENDER_HEIGHT}px`,
              transform: anchorTransform,
              zIndex: caption.zIndex,
              maxWidth: `${style.maxWidthPx ?? CAPTION_MAX_WIDTH_PX}px`,
              touchAction: 'none',
              cursor: readOnly ? 'default' : isEditing ? 'text' : 'move',
              color: CAPTION_TEXT_COLOR,
              fontFamily: CAPTION_FONT_FAMILY,
              fontSize: `${CAPTION_BASE_FONT_SIZE_PX * style.scale}px`,
              fontWeight: CAPTION_FONT_WEIGHT,
              lineHeight: `${CAPTION_LINE_HEIGHT_PX * style.scale}px`,
              whiteSpace: CAPTION_WHITE_SPACE,
              overflowWrap: CAPTION_OVERFLOW_WRAP,
              wordBreak: CAPTION_WORD_BREAK,
              lineBreak: CAPTION_LINE_BREAK,
              padding: style.boxed
                ? `${CAPTION_BOX_PADDING_Y_PX * style.scale}px ${
                    CAPTION_BOX_PADDING_X_PX * style.scale
                  }px`
                : '0px',
              borderRadius: `${CAPTION_BOX_BORDER_RADIUS_PX * style.scale}px`,
              backgroundColor: style.boxed
                ? `rgba(0, 0, 0, ${CAPTION_BOX_BACKGROUND_OPACITY})`
                : 'transparent',
              boxShadow: style.boxed
                ? `0 ${CAPTION_SHADOW_OFFSET_Y_PX * style.scale}px ${
                    CAPTION_SHADOW_BLUR_PX * style.scale
                  }px ${CAPTION_SHADOW_COLOR}`
                : 'none',
              outline:
                isSelected && !readOnly
                  ? `${Math.max(2, 3 / previewScale)}px solid rgba(255,77,109,0.9)`
                  : 'none',
              outlineOffset: `${Math.max(2, 4 / previewScale)}px`,
            }}
          >
            {isEditing ? (
              <input
                ref={inputRef}
                value={caption.text}
                onChange={(event) => onTextChange(event.target.value)}
                onBlur={() => onEdit(null)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onEdit(null);
                }}
                onPointerDown={(event) => event.stopPropagation()}
                placeholder="자막을 입력하세요"
                className="w-full bg-transparent text-center text-white placeholder:text-white/60 focus:outline-none"
                style={{
                  minWidth: `${CAPTION_INPUT_MIN_WIDTH_PX}px`,
                  fontFamily: CAPTION_FONT_FAMILY,
                  fontWeight: CAPTION_FONT_WEIGHT,
                }}
              />
            ) : (
              <span
                className={`block text-center ${
                  hasText ? 'text-white' : 'text-white/55'
                }`}
              >
                {hasText ? caption.text : '자막을 입력하세요'}
              </span>
            )}
            {isSelected && !isEditing && !readOnly && (
              <button
                type="button"
                onPointerDown={onResizePointerDown}
                onPointerMove={onResizePointerMove}
                onPointerUp={onResizePointerEnd}
                onPointerCancel={onResizePointerEnd}
                onClick={(event) => event.stopPropagation()}
                className="absolute flex items-center justify-center rounded-full border border-white/40 bg-[#FF4D6D] font-bold text-white shadow-lg"
                style={{
                  right: `-${CAPTION_RESIZE_HANDLE_OFFSET_PX}px`,
                  bottom: `-${CAPTION_RESIZE_HANDLE_OFFSET_PX}px`,
                  width: `${CAPTION_RESIZE_HANDLE_SIZE_PX}px`,
                  height: `${CAPTION_RESIZE_HANDLE_SIZE_PX}px`,
                  fontSize: `${CAPTION_RESIZE_HANDLE_FONT_SIZE_PX}px`,
                }}
                aria-label="텍스트 크기 조절"
              >
                ↔
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
