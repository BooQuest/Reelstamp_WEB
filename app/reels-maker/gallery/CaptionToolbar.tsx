"use client";
import { useUiText } from "@/app/i18n/LocaleProvider";

import { useEffect, useRef, useState } from "react";
import { CAPTION_BASE_FONT_SIZE_PX } from "../constants";
import { Copy } from "lucide-react";
import type { CaptionOrderAction } from "./captionActions";
import type { CaptionItem, CaptionStyle } from "../types";
import { TEXT_COLORS, withGalleryStyle } from "./captionStyle";

type Props = {
  captions?: CaptionItem[];
  selectedCaptionId?: string | null;
  canDuplicate?: boolean;
  onDuplicate?: () => void;
  onReorder?: (direction: CaptionOrderAction) => void;
  onSelectCaption?: (id: string) => void;
  onResetStyle?: () => void;
  style: CaptionStyle;
  onChange: (style: CaptionStyle) => void;
  onDone: () => void;
  onDelete: () => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
  allowResize?: boolean;
};
type Choice = { label: string; changes: Partial<CaptionStyle> };
const TOOLS: Record<string, Choice[]> = {
  글꼴: [
    {
      label: "Pretendard",
      changes: { fontFamily: "ReelstampCaptionPretendard" },
    },
    {
      label: "Noto Serif KR",
      changes: { fontFamily: "ReelstampCaptionNotoSerif" },
    },
  ],
  정렬: [
    { label: "왼쪽", changes: { textAlign: "left" } },
    { label: "가운데", changes: { textAlign: "center" } },
    { label: "오른쪽", changes: { textAlign: "right" } },
  ],
  배경: [
    { label: "없음", changes: { boxed: false } },
    { label: "검정", changes: { boxed: true, boxBackgroundColor: "#000000" } },
    { label: "흰색", changes: { boxed: true, boxBackgroundColor: "#FFFFFF" } },
    { label: "불투명", changes: { boxBackgroundOpacity: 1 } },
    { label: "반투명", changes: { boxBackgroundOpacity: 0.5 } },
  ],
};
export default function CaptionToolbar({
  captions = [],
  selectedCaptionId,
  canDuplicate = false,
  onDuplicate,
  onReorder,
  onSelectCaption,
  onResetStyle,
  style,
  onChange,
  onDone,
  onDelete,
  onInteractionStart,
  onInteractionEnd,
  allowResize = true,
}: Props) {
  const t = useUiText();
  const selectedIndex = captions.findIndex(
    (item) => item.id === selectedCaptionId,
  );
  const duplicateReason =
    captions.length >= 5
      ? t("텍스트는 컷당 최대 5개까지 추가할 수 있어요.")
      : t("복제할 텍스트를 입력하세요.");
  const [bottom, setBottom] = useState(0);
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
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
    };
  }, []);
  const sizing = useRef(false);
  const [tool, setTool] = useState<string>("글꼴");
  const activeTool = !allowResize && (tool === "크기" || tool === "순서") ? "글꼴" : tool;
  const normalized = withGalleryStyle(style, {});
  const change = (changes: Partial<CaptionStyle>) => {
    onInteractionStart?.();
    onChange(withGalleryStyle(style, changes));
    onInteractionEnd?.();
  };
  const scale = Math.round(style.scale * 100);
  const setScale = (value: number) =>
    onChange({
      ...style,
      scale: Math.min(220, Math.max(60, Math.round(value))) / 100,
    });
  const pointerScale = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setScale(
      60 +
        Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) *
          160,
    );
  };
  const endScale = () => {
    if (!sizing.current) return;
    sizing.current = false;
    onInteractionEnd?.();
  };
  return (
    <div
      role="toolbar"
      aria-label={t("텍스트 도구")}
      data-caption-toolbar
      style={{ bottom }}
      className="fixed inset-x-0 z-[85] mx-auto w-full max-w-2xl shrink-0 space-y-2 border-t border-white/20 bg-[#182335] p-3 text-xs text-white shadow-xl"
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("button")) e.preventDefault();
      }}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {[
            "글꼴",
            ...(allowResize ? ["크기"] : []),
            "스타일",
            "정렬",
            "색상",
            "배경",
            ...(allowResize ? ["순서"] : []),
          ].map((name) => (
            <button
              type="button"
              key={name}
              aria-pressed={activeTool === name}
              onClick={() => setTool(name)}
              className="shrink-0 whitespace-nowrap rounded px-2 py-2 aria-pressed:bg-white/15"
            >
              {t(name)}
            </button>
          ))}
        </div>
        {allowResize && (
          <span
            className="shrink-0"
            title={canDuplicate ? t("텍스트 복제") : duplicateReason}
          >
            <button
              type="button"
              aria-label={t("텍스트 복제")}
              aria-describedby={
                !canDuplicate ? "caption-duplicate-reason" : undefined
              }
              onClick={onDuplicate}
              disabled={!canDuplicate}
              className="flex h-11 w-11 items-center justify-center rounded disabled:opacity-40"
            >
              <Copy size={18} aria-hidden="true" />
            </button>
            {!canDuplicate && (
              <span id="caption-duplicate-reason" className="sr-only">
                {duplicateReason}
              </span>
            )}
          </span>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 p-2 text-rose-300"
        >
          {t("삭제")}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="shrink-0 rounded bg-rose-500 p-2"
        >
          {t("완료")}
        </button>
      </div>
      <div className="flex min-h-9 flex-wrap items-center justify-center gap-2">
        {activeTool === "순서" && allowResize ? (
          <div className="w-full space-y-2" data-caption-order-panel>
            <div className="flex flex-wrap justify-center gap-1">
              {(
                [
                  ["forward", "앞으로"],
                  ["backward", "뒤로"],
                  ["front", "맨 앞으로"],
                  ["back", "맨 뒤로"],
                ] as const
              ).map(([direction, label]) => (
                <button
                  key={direction}
                  type="button"
                  onClick={() => onReorder?.(direction)}
                  disabled={
                    selectedIndex < 0 ||
                    (direction === "forward" || direction === "front"
                      ? selectedIndex === captions.length - 1
                      : selectedIndex === 0)
                  }
                  className="min-h-11 rounded bg-white/10 px-2 disabled:opacity-35"
                >
                  {t.format(label, {})}
                </button>
              ))}
            </div>
            <div
              role="group"
              aria-label={t("텍스트 겹침 순서")}
              className="max-h-[120px] overflow-y-auto overscroll-contain"
            >
              {[...captions].reverse().map((item) => (
                <button
                  key={item.id}
                  type="button"
                  data-caption-layer={item.id}
                  aria-pressed={item.id === selectedCaptionId}
                  onClick={() => onSelectCaption?.(item.id)}
                  title={item.text || t("빈 텍스트")}
                  className="block min-h-11 w-full truncate rounded px-3 py-2 text-left aria-pressed:bg-rose-500/25 aria-pressed:ring-1 aria-pressed:ring-inset aria-pressed:ring-rose-500"
                >
                  {item.text.trim() || t("빈 텍스트")}
                </button>
              ))}
            </div>
          </div>
        ) : activeTool === "크기" ? (
          <div className="w-full px-2" data-caption-size-panel>
            <output
              className="mb-1 block text-center tabular-nums"
              aria-live="polite"
            >
              {t("글자 크기")}{" "}
              {(CAPTION_BASE_FONT_SIZE_PX * style.scale).toFixed(1)} px ·{" "}
              {scale}%
            </output>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="h-11 w-11 shrink-0 rounded bg-white/10 disabled:opacity-40"
                aria-label={t("텍스트 축소")}
                disabled={scale <= 60}
                onClick={() => {
                  onInteractionStart?.();
                  setScale(scale - 1);
                  onInteractionEnd?.();
                }}
              >
                −
              </button>
              <div
                role="slider"
                tabIndex={0}
                aria-label={t("텍스트 크기")}
                aria-valuemin={60}
                aria-valuemax={220}
                aria-valuenow={scale}
                aria-valuetext={`${scale}%`}
                className="relative flex h-11 min-w-0 flex-1 touch-none items-center outline-offset-2"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  sizing.current = true;
                  onInteractionStart?.();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  pointerScale(event);
                }}
                onPointerMove={(event) => {
                  if (sizing.current) pointerScale(event);
                }}
                onPointerUp={endScale}
                onPointerCancel={endScale}
                onLostPointerCapture={endScale}
                onKeyDown={(event) => {
                  const values: Record<string, number> = {
                    ArrowLeft: scale - 1,
                    ArrowDown: scale - 1,
                    ArrowRight: scale + 1,
                    ArrowUp: scale + 1,
                    Home: 60,
                    End: 220,
                  };
                  if (!(event.key in values)) return;
                  event.preventDefault();
                  event.stopPropagation();
                  if (!sizing.current) {
                    sizing.current = true;
                    onInteractionStart?.();
                  }
                  setScale(values[event.key]);
                }}
                onKeyUp={endScale}
                onBlur={endScale}
              >
                <div className="h-1 w-full rounded bg-white/25" />
                <span
                  className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 rounded-full bg-rose-500"
                  style={{ left: `${((scale - 60) / 160) * 100}%` }}
                />
              </div>
              <button
                type="button"
                className="h-11 w-11 shrink-0 rounded bg-white/10 disabled:opacity-40"
                aria-label={t("텍스트 확대")}
                disabled={scale >= 220}
                onClick={() => {
                  onInteractionStart?.();
                  setScale(scale + 1);
                  onInteractionEnd?.();
                }}
              >
                +
              </button>
            </div>
          </div>
        ) : activeTool === "스타일" ? (
          <>
            {[
              { label: "기본", weight: 400 },
              { label: "굵게", weight: 700 },
            ].map(({ label, weight }) => (
              <button
                key={label}
                type="button"
                aria-pressed={normalized.fontWeight === weight}
                className="rounded bg-white/5 px-3 py-2 aria-pressed:ring-1 aria-pressed:ring-rose-500"
                onClick={() =>
                  change({
                    fontWeight: weight,
                    textPreset:
                      normalized.textPreset === "shadow"
                        ? "shadow"
                        : weight === 700
                          ? "bold"
                          : "basic",
                  })
                }
              >
                {t(label)}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={normalized.textPreset === "shadow"}
              className="rounded bg-white/5 px-3 py-2 aria-pressed:ring-1 aria-pressed:ring-rose-500"
              onClick={() =>
                change({
                  textPreset:
                    normalized.textPreset === "shadow"
                      ? normalized.fontWeight === 700
                        ? "bold"
                        : "basic"
                      : "shadow",
                  fontWeight: normalized.fontWeight,
                })
              }
            >
              {t("그림자")}
            </button>
            {allowResize && (
              <button
                type="button"
                onClick={onResetStyle}
                className="min-h-11 rounded border border-white/25 px-3 py-2"
              >
                {t("스타일 초기화")}
              </button>
            )}
          </>
        ) : activeTool === "색상" ? (
          TEXT_COLORS.map((color) => (
            <button
              type="button"
              key={color}
              aria-label={t.format("텍스트 색상 {v0}", { v0: color })}
              aria-pressed={normalized.textColor === color}
              onClick={() => change({ textColor: color })}
              className="h-7 w-7 rounded-full border-2 border-white/50 aria-pressed:ring-2 aria-pressed:ring-rose-500"
              style={{ backgroundColor: color }}
            />
          ))
        ) : (
          TOOLS[activeTool].map((choice) => (
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
              {t(choice.label)}
            </button>
          ))
        )}
      </div>
      {allowResize && captions.length >= 5 && <p className="text-center text-white/70" role="status">{duplicateReason}</p>}
    </div>
  );
}
