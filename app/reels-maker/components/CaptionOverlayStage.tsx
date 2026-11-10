"use client";
import { useUiText } from "@/app/i18n/LocaleProvider";

import { useLayoutEffect, useRef } from "react";
import { flushSync } from "react-dom";
import type {
  MutableRefObject,
  ReactNode,
  PointerEvent as ReactPointerEvent,
} from "react";
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
} from "../constants";
import { Pencil } from "lucide-react";
import { captionTextStyle, captionBackground } from "../gallery/captionStyle";
import type { CaptionItem } from "../types";

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
  manual: boolean;
};

function CaptionTextEditor({
  value,
  inputRef,
  onTextChange,
  onEdit,
  manual,
}: CaptionTextEditorProps) {
  const t = useUiText();
  return (
    <textarea
      ref={inputRef}
      value={value}
      rows={1}
      wrap={manual ? "off" : "soft"}
      onChange={(event) => {
        onTextChange(event.target.value);
      }}
      onBlur={(event) => {
        if (
          (event.relatedTarget as HTMLElement | null)?.closest(
            "[data-caption-toolbar], [data-caption-selection]",
          )
        )
          return;
        onEdit(null);
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          onEdit(null);
        }
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      placeholder={t("자막을 입력하세요")}
      className="absolute inset-0 box-border block h-full w-full resize-none overflow-hidden border-0 bg-transparent p-0 placeholder:text-white/60 focus:outline-none"
      style={{
        // Keep the measured box unchanged while allowing descenders below the last line.
        height: "calc(100% + 0.15em)",
        minWidth: 0,
        borderRadius: 0,
        margin: 0,
        fontFamily: "inherit",
        fontWeight: "inherit",
        color: "inherit",
        textAlign: "inherit",
        fontSize: "inherit",
        lineHeight: "inherit",
        whiteSpace: manual ? "pre" : CAPTION_WHITE_SPACE,
        overflowWrap: manual ? "normal" : CAPTION_OVERFLOW_WRAP,
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
  onResizePointerDown,
  onResizePointerMove,
  onResizePointerEnd,
}: Props) {
  const t = useUiText();
  const pointerIntentRef = useRef<CaptionPointerIntent | null>(null);
  const suppressClickRef = useRef(false);
  const activePointers = useRef(new Set<number>());

  const selected = captions.find((item) => item.id === selectedCaptionId && item.source !== "AUTO");
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
        transformOrigin: "center center",
      }}
    >
      <div className="absolute inset-0 overflow-hidden" data-caption-content-clip>
      {captions.map((caption) => {
        const isSelected = caption.id === selectedCaptionId;
        const isEditing = !readOnly && caption.id === editingCaptionId;
        const hasText = caption.text.trim().length > 0;
        const style = caption.style;
        const manual = caption.source !== "AUTO";
        const maxWidthPx = style.maxWidthPx ?? CAPTION_MAX_WIDTH_PX;
        const anchorTransform =
          style.anchorY === "BOTTOM"
            ? "translate(-50%, -100%)"
            : "translate(-50%, -50%)";

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
              boxSizing: "border-box",
              // Avoid absolute-position shrink-to-fit changing wraps as left moves.
              width: "max-content",
              maxWidth: manual ? "none" : `${maxWidthPx}px`,
              touchAction: "none",
              cursor: readOnly ? "default" : isEditing ? "text" : "move",
              fontSize: `${CAPTION_BASE_FONT_SIZE_PX * style.scale}px`,
              lineHeight: `${CAPTION_LINE_HEIGHT_PX * style.scale}px`,
              whiteSpace: manual ? "pre" : CAPTION_WHITE_SPACE,
              overflowWrap: manual ? "normal" : CAPTION_OVERFLOW_WRAP,
              wordBreak: CAPTION_WORD_BREAK,
              lineBreak: CAPTION_LINE_BREAK,
              padding: style.boxed
                ? `${CAPTION_BOX_PADDING_Y_PX * style.scale}px ${
                    CAPTION_BOX_PADDING_X_PX * style.scale
                  }px`
                : "0px",
              borderRadius: `${CAPTION_BOX_BORDER_RADIUS_PX * style.scale}px`,
              backgroundColor: style.boxed
                ? CAPTION_BOX_BACKGROUND_COLOR
                : "transparent",
              boxShadow: style.boxed
                ? `0 ${CAPTION_SHADOW_OFFSET_Y_PX * style.scale}px ${
                    CAPTION_SHADOW_BLUR_PX * style.scale
                  }px ${CAPTION_SHADOW_COLOR}`
                : "none",
              outline:
                isSelected && !readOnly && !manual
                  ? `${Math.max(2, 3 / previewScale)}px solid rgba(255,77,109,0.9)`
                  : "none",
              ...captionTextStyle(style),
              ...(style.styleVersion === "CAPTION_RENDER_V2"
                ? { backgroundColor: captionBackground(style) }
                : {}),
              outlineOffset: `${Math.max(2, 4 / previewScale)}px`,
            }}
          >
            <div className="relative">
              <span
                aria-hidden={isEditing || undefined}
                className={`block ${hasText ? "" : "opacity-55"}`}
                style={{ visibility: isEditing ? "hidden" : undefined }}
              >
                {hasText ? caption.text : t("자막을 입력하세요")}
                {caption.text.endsWith("\n") ? "\u200b" : null}
              </span>
              {isEditing && (
                <CaptionTextEditor
                  manual={manual}
                  value={caption.text}
                  inputRef={inputRef}
                  onTextChange={onTextChange}
                  onEdit={onEdit}
                />
              )}
            </div>
            {isSelected && !isEditing && !readOnly && !manual && (
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
                aria-label={t("텍스트 편집")}
              >
                <Pencil className="h-full w-full p-1" />
              </button>
            )}
          </div>
        );
      })}
      </div>
      {selected && !readOnly && (
        <CaptionSelectionFrame caption={selected} overlayRef={overlayRef} previewScale={previewScale}>
          {(["top", "right", "bottom", "left"] as const).map((edge) => {
            const hit = 14 / previewScale;
            return <div key={edge} data-caption-move={edge}
              className="pointer-events-auto absolute" style={{
                touchAction: "none", cursor: "move",
                ...(edge === "top" || edge === "bottom"
                  ? { left: 0, right: 0, height: hit, [edge]: -hit }
                  : { top: 0, bottom: 0, width: hit, [edge]: -hit }),
              }}
              onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); onCaptionPointerDown(event, selected); }}
              onPointerMove={onCaptionPointerMove} onPointerUp={onCaptionPointerEnd} onPointerCancel={onCaptionPointerEnd}
              onClick={(event) => event.stopPropagation()} />;
          })}
          {(["top-left", "top-right", "bottom-left", "bottom-right"] as const).map((corner) => (
            <button key={corner} type="button" data-caption-resize={corner}
              aria-label={t({ "top-left": "텍스트 왼쪽 위 크기 조절", "top-right": "텍스트 오른쪽 위 크기 조절", "bottom-left": "텍스트 왼쪽 아래 크기 조절", "bottom-right": "텍스트 오른쪽 아래 크기 조절" }[corner])}
              className="pointer-events-auto absolute flex items-center justify-center"
              style={{ width: 44 / previewScale, height: 44 / previewScale, touchAction: "none",
                left: corner.endsWith("left") ? 0 : "100%", top: corner.startsWith("top") ? 0 : "100%",
                transform: `translate(${corner.endsWith("left") ? "-100%" : "0"}, ${corner.startsWith("top") ? "-100%" : "0"})`, cursor: corner === "top-left" || corner === "bottom-right" ? "nwse-resize" : "nesw-resize" }}
              onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); onResizePointerDown(event); }}
              onPointerMove={onResizePointerMove} onPointerUp={onResizePointerEnd} onPointerCancel={onResizePointerEnd}
              onClick={(event) => { event.preventDefault(); event.stopPropagation(); }}>
              <span className="absolute rounded-full border-2 border-white bg-rose-500" style={{ left: corner.endsWith("left") ? "100%" : 0, top: corner.startsWith("top") ? "100%" : 0, transform: "translate(-50%, -50%)", width: 10 / previewScale, height: 10 / previewScale }} />
            </button>
          ))}
          {selected.id !== editingCaptionId && (
            <button type="button" className="pointer-events-auto absolute rounded-full bg-rose-500 p-1 text-white"
              style={{ left: "50%", top: -32 / previewScale, width: 24 / previewScale, height: 24 / previewScale, transform: "translateX(-50%)" }}
              aria-label={t("텍스트 편집")} onPointerDown={(event) => event.preventDefault()}
              onClick={(event) => { event.stopPropagation(); openEditor(selected.id); }}><Pencil className="h-full w-full" /></button>
          )}
        </CaptionSelectionFrame>
      )}
    </div>
  );
}

function CaptionSelectionFrame({ caption, overlayRef, previewScale, children }: {
  caption: CaptionItem; overlayRef: MutableRefObject<HTMLDivElement | null>; previewScale: number; children: ReactNode;
}) {
  const frame = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = overlayRef.current;
    if (!node) return;
    const update = () => {
      if (!frame.current) return;
      frame.current.style.width = `${node.offsetWidth}px`;
      frame.current.style.height = `${node.offsetHeight}px`;
    };
    update();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(node);
    return () => observer?.disconnect();
  }, [caption.id, caption.text, caption.style, overlayRef]);
  return <div ref={frame} data-caption-selection={caption.id} className="pointer-events-none absolute" style={{
    left: caption.style.xRatio * CAPTION_RENDER_WIDTH, top: caption.style.yRatio * CAPTION_RENDER_HEIGHT,
    transform: caption.style.anchorY === "BOTTOM" ? "translate(-50%, -100%)" : "translate(-50%, -50%)",
    zIndex: 10000, outline: `${2 / previewScale}px solid #ff4d6d`, outlineOffset: `${3 / previewScale}px`,
  }}>{children}</div>;
}
