'use client';
import { useUiText } from '@/app/i18n/LocaleProvider';

import { useRef } from 'react';
import { flushSync } from 'react-dom';
import type {
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
} from 'react';
import {
  CAPTION_BASE_FONT_SIZE_PX,
  CAPTION_BOX_BACKGROUND_COLOR,
  CAPTION_BOX_BORDER_RADIUS_PX,
  CAPTION_BOX_PADDING_X_PX,
  CAPTION_BOX_PADDING_Y_PX,
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
  CAPTION_WHITE_SPACE,
  CAPTION_WORD_BREAK,
} from '../constants';
import { Pencil } from 'lucide-react';
import { captionTextStyle, captionBackground } from '../gallery/captionStyle';
import type { CaptionItem } from '../types';

const CAPTION_TAP_MOVE_TOLERANCE_PX = 6;

type CaptionPointerIntent = {
  captionId: string;
  startX: number;
  startY: number;
  moved: boolean;
};

type Props = {
  captions: CaptionItem[];
  selectedCaptionId: string | null;
  editingCaptionId: string | null;
  previewScale: number;
  stageRef: MutableRefObject<HTMLDivElement | null>;
  overlayRef: MutableRefObject<HTMLDivElement | null>;
  inputRef: MutableRefObject<HTMLTextAreaElement | null>;
  readOnly?: boolean;
  onSelect: (captionId: string) => void;
  onEdit: (captionId: string | null) => void;
  onTextChange: (value: string) => void;
  onCaptionPointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    caption: CaptionItem,
  ) => void;
  onCaptionPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onCaptionPointerEnd: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizePointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onResizePointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onResizePointerEnd: (event: ReactPointerEvent<HTMLButtonElement>) => void;
};

type CaptionTextEditorProps = {
  value: string;
  inputRef: MutableRefObject<HTMLTextAreaElement | null>;
  onTextChange: (value: string) => void;
  onEdit: (captionId: string | null) => void;
};

function CaptionTextEditor({
  value,
  inputRef,
  onTextChange,
  onEdit,
}: CaptionTextEditorProps) {
  const t = useUiText();
  return (
    <textarea
      ref={inputRef}
      value={value}
      rows={1}
      wrap="soft"
      onChange={(event) => {
        onTextChange(event.target.value);
      }}
      onBlur={(event) => {
        if (
          (event.relatedTarget as HTMLElement | null)?.closest(
            '[data-caption-toolbar]',
          )
        )
          return;
        onEdit(null);
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Escape') {
          event.preventDefault();
          onEdit(null);
        }
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      placeholder={t('자막을 입력하세요')}
      className="absolute inset-0 box-border block h-full w-full resize-none overflow-hidden border-0 bg-transparent p-0 placeholder:text-white/60 focus:outline-none"
      style={{
        // Keep the measured box unchanged while allowing descenders below the last line.
        height: 'calc(100% + 0.15em)',
        minWidth: 0,
        borderRadius: 0,
        margin: 0,
        fontFamily: 'inherit',
        fontWeight: 'inherit',
        color: 'inherit',
        textAlign: 'inherit',
        fontSize: 'inherit',
        lineHeight: 'inherit',
        whiteSpace: CAPTION_WHITE_SPACE,
        overflowWrap: CAPTION_OVERFLOW_WRAP,
        wordBreak: CAPTION_WORD_BREAK,
      }}
    />
  );
}

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
}: Props) {
  const t = useUiText();
  const pointerIntentRef = useRef<CaptionPointerIntent | null>(null);
  const suppressClickRef = useRef(false);
  const activePointers = useRef(new Set<number>());

  const openEditor = (captionId: string) => {
    // Mount and focus within the tap gesture so iOS opens its software keyboard.
    flushSync(() => {
      onSelect(captionId);
      onEdit(captionId);
    });
    inputRef.current?.focus({ preventScroll: true });
  };

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
        const maxWidthPx = style.maxWidthPx ?? CAPTION_MAX_WIDTH_PX;
        const anchorTransform =
          style.anchorY === 'BOTTOM'
            ? 'translate(-50%, -100%)'
            : 'translate(-50%, -50%)';

        return (
          <div
            key={caption.id}
            data-caption-id={caption.id}
            ref={isSelected ? overlayRef : undefined}
            onClick={(event) => {
              event.stopPropagation();
              if (readOnly) return;
              if (suppressClickRef.current) return;
              event.preventDefault();
              openEditor(caption.id);
            }}
            onPointerDown={(event) => {
              if (readOnly) return;
              activePointers.current.add(event.pointerId);
              if (activePointers.current.size > 1) {
                if (pointerIntentRef.current)
                  pointerIntentRef.current.moved = true;
                suppressClickRef.current = true;
                onCaptionPointerDown(event, caption);
                return;
              }
              suppressClickRef.current = false;
              pointerIntentRef.current = {
                captionId: caption.id,
                startX: event.clientX,
                startY: event.clientY,
                moved: false,
              };
              onCaptionPointerDown(event, caption);
            }}
            onPointerMove={(event) => {
              if (readOnly) return;
              const pointerIntent = pointerIntentRef.current;
              if (pointerIntent) {
                const distance = Math.hypot(
                  event.clientX - pointerIntent.startX,
                  event.clientY - pointerIntent.startY,
                );
                if (
                  !pointerIntent.moved &&
                  distance <= CAPTION_TAP_MOVE_TOLERANCE_PX
                )
                  return;
                if (distance > CAPTION_TAP_MOVE_TOLERANCE_PX) {
                  pointerIntent.moved = true;
                }
              }
              onCaptionPointerMove(event);
            }}
            onPointerUp={(event) => {
              if (readOnly) return;
              activePointers.current.delete(event.pointerId);
              const pointerIntent = pointerIntentRef.current;
              if (pointerIntent) {
                if (pointerIntent.moved) {
                  suppressClickRef.current = true;
                }
                pointerIntentRef.current = null;
              }
              onCaptionPointerEnd(event);
            }}
            onPointerCancel={(event) => {
              if (readOnly) return;
              activePointers.current.delete(event.pointerId);
              suppressClickRef.current = true;
              const pointerIntent = pointerIntentRef.current;
              if (pointerIntent) {
                pointerIntentRef.current = null;
              }
              onCaptionPointerEnd(event);
            }}
            className="pointer-events-auto absolute select-none"
            style={{
              left: `${style.xRatio * CAPTION_RENDER_WIDTH}px`,
              top: `${style.yRatio * CAPTION_RENDER_HEIGHT}px`,
              transform: anchorTransform,
              zIndex: caption.zIndex,
              boxSizing: 'border-box',
              // Avoid absolute-position shrink-to-fit changing wraps as left moves.
              width: 'max-content',
              maxWidth: `${maxWidthPx}px`,
              touchAction: 'none',
              cursor: readOnly ? 'default' : isEditing ? 'text' : 'move',
              fontSize: `${CAPTION_BASE_FONT_SIZE_PX * style.scale}px`,
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
                ? CAPTION_BOX_BACKGROUND_COLOR
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
              ...captionTextStyle(style),
              ...(style.styleVersion === 'CAPTION_RENDER_V2'
                ? { backgroundColor: captionBackground(style) }
                : {}),
              outlineOffset: `${Math.max(2, 4 / previewScale)}px`,
            }}
          >
            <div className="relative">
              <span
                aria-hidden={isEditing || undefined}
                className={`block whitespace-pre-wrap ${hasText ? '' : 'opacity-55'}`}
                style={{ visibility: isEditing ? 'hidden' : undefined }}
              >
                {hasText ? caption.text : t('자막을 입력하세요')}
                {caption.text.endsWith('\n') ? '\u200b' : null}
              </span>
              {isEditing && (
                <CaptionTextEditor
                  value={caption.text}
                  inputRef={inputRef}
                  onTextChange={onTextChange}
                  onEdit={onEdit}
                />
              )}
            </div>
            {isSelected && !isEditing && !readOnly && (
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  event.preventDefault();
                  openEditor(caption.id);
                }}
                className="absolute flex items-center justify-center rounded-full border border-white/40 bg-[#FF4D6D] font-bold text-white shadow-lg"
                style={{
                  right: `-${CAPTION_RESIZE_HANDLE_OFFSET_PX}px`,
                  bottom: `-${CAPTION_RESIZE_HANDLE_OFFSET_PX}px`,
                  width: `${CAPTION_RESIZE_HANDLE_SIZE_PX}px`,
                  height: `${CAPTION_RESIZE_HANDLE_SIZE_PX}px`,
                  fontSize: `${CAPTION_RESIZE_HANDLE_FONT_SIZE_PX}px`,
                }}
                aria-label={t('텍스트 편집')}
              >
                <Pencil className="h-full w-full p-1" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
