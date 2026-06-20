'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type PointerEvent,
  type SetStateAction,
} from 'react';
import {
  CAPTION_RENDER_HEIGHT,
  CAPTION_RENDER_WIDTH,
  DEFAULT_CAPTION_STYLE,
  MAX_CAPTION_SCALE,
  MAX_CAPTIONS_PER_CLIP,
  MIN_CAPTION_SCALE,
} from '../constants';
import type {
  CaptionGestureState,
  CaptionItem,
  CaptionStyle,
  Stage,
} from '../types';
import {
  clampValue,
  createCaptionId,
  normalizeCaptionStyle,
} from '../utils/captions';

type Props = {
  activeClipId: number | null;
  showCaptionStage: boolean;
  stage: Stage;
  captions: CaptionItem[];
  setCaptions: Dispatch<SetStateAction<CaptionItem[]>>;
  captionsRef: MutableRefObject<CaptionItem[]>;
  cameraFrameRef: MutableRefObject<HTMLDivElement | null>;
};

export default function useCaptionEditor({
  activeClipId,
  showCaptionStage,
  stage,
  captions,
  setCaptions,
  captionsRef,
  cameraFrameRef,
}: Props) {
  const captionStageRef = useRef<HTMLDivElement | null>(null);
  const captionOverlayRef = useRef<HTMLDivElement | null>(null);
  const captionInputRef = useRef<HTMLInputElement | null>(null);
  const captionGestureRef = useRef<CaptionGestureState>({
    mode: 'none',
    captionId: null,
    pointerMap: new Map(),
    dragPointerId: null,
    startPointer: null,
    startStyle: null,
    startDistance: 0,
    startScale: 1,
  });
  const [cameraFrameElement, setCameraFrameElement] =
    useState<HTMLDivElement | null>(null);
  const [captionPreviewScale, setCaptionPreviewScale] = useState(1);
  const [selectedCaptionId, setSelectedCaptionId] = useState<string | null>(
    null
  );
  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null);

  const activeCaptions = useMemo(
    () =>
      activeClipId == null
        ? []
        : captions
            .filter(
              (caption) =>
                caption.placement.type === 'CLIP' &&
                caption.placement.clipId === activeClipId
            )
            .sort((a, b) => a.zIndex - b.zIndex),
    [activeClipId, captions]
  );
  const resolvedSelectedCaptionId = activeCaptions.some(
    (caption) => caption.id === selectedCaptionId
  )
    ? selectedCaptionId
    : activeCaptions[0]?.id ?? null;
  const activeCaptionItem =
    activeCaptions.find(
      (caption) => caption.id === resolvedSelectedCaptionId
    ) ?? null;
  const activeCaptionText = activeCaptionItem?.text ?? '';
  const activeCaptionStyle = activeCaptionItem?.style ?? DEFAULT_CAPTION_STYLE;
  const showCaptionOverlay = showCaptionStage && activeCaptions.length > 0;

  const resetCaptionGesture = useCallback(() => {
    const gesture = captionGestureRef.current;
    gesture.mode = 'none';
    gesture.captionId = null;
    gesture.pointerMap.clear();
    gesture.dragPointerId = null;
    gesture.startPointer = null;
    gesture.startStyle = null;
    gesture.startDistance = 0;
    gesture.startScale = 1;
  }, []);

  const handleCameraFrameRef = useCallback(
    (element: HTMLDivElement | null) => {
      cameraFrameRef.current = element;
      setCameraFrameElement(element);
    },
    [cameraFrameRef]
  );

  const getCaptionInteractionRect = useCallback(
    () =>
      captionStageRef.current?.getBoundingClientRect() ??
      cameraFrameRef.current?.getBoundingClientRect() ??
      null,
    [cameraFrameRef]
  );

  const updateCaptionById = useCallback(
    (captionId: string, updater: (current: CaptionItem) => CaptionItem) => {
      setCaptions((prev) =>
        prev.map((caption) =>
          caption.id === captionId ? updater(caption) : caption
        )
      );
    },
    [setCaptions]
  );

  const clampCaptionPosition = useCallback(
    (rawXRatio: number, rawYRatio: number) => {
      const normalizedX = clampValue(rawXRatio, 0, 1);
      const normalizedY = clampValue(rawYRatio, 0, 1);
      const interactionRect = getCaptionInteractionRect();
      if (
        !interactionRect ||
        interactionRect.width <= 0 ||
        interactionRect.height <= 0
      ) {
        return { xRatio: normalizedX, yRatio: normalizedY };
      }

      const overlayRect = captionOverlayRef.current?.getBoundingClientRect();
      const halfWidth = overlayRect
        ? Math.min(overlayRect.width / 2, interactionRect.width / 2)
        : 0;
      const halfHeight = overlayRect
        ? Math.min(overlayRect.height / 2, interactionRect.height / 2)
        : 0;
      const minX = halfWidth / interactionRect.width;
      const maxX = 1 - minX;
      const minY = halfHeight / interactionRect.height;
      const maxY = 1 - minY;

      return {
        xRatio: minX > maxX ? 0.5 : clampValue(normalizedX, minX, maxX),
        yRatio: minY > maxY ? 0.5 : clampValue(normalizedY, minY, maxY),
      };
    },
    [getCaptionInteractionRect]
  );

  const applyClampedCaptionStyle = useCallback(
    (style: CaptionStyle) => {
      const normalized = normalizeCaptionStyle(style);
      return {
        ...normalized,
        ...clampCaptionPosition(normalized.xRatio, normalized.yRatio),
      };
    },
    [clampCaptionPosition]
  );

  const updateActiveCaptionText = useCallback(
    (text: string) => {
      if (!resolvedSelectedCaptionId) return;
      updateCaptionById(resolvedSelectedCaptionId, (current) => ({
        ...current,
        text,
      }));
    },
    [resolvedSelectedCaptionId, updateCaptionById]
  );

  const updateActiveCaptionStyle = useCallback(
    (updater: (style: CaptionStyle) => CaptionStyle) => {
      if (!resolvedSelectedCaptionId) return;
      updateCaptionById(resolvedSelectedCaptionId, (current) => ({
        ...current,
        style: applyClampedCaptionStyle(updater(current.style)),
      }));
    },
    [
      applyClampedCaptionStyle,
      resolvedSelectedCaptionId,
      updateCaptionById,
    ]
  );

  const addCaptionToActiveClip = useCallback(() => {
    if (!showCaptionStage || activeClipId == null) return;
    if (activeCaptions.length >= MAX_CAPTIONS_PER_CLIP) return;

    const captionId = createCaptionId();
    const nextZIndex =
      activeCaptions.reduce(
        (max, caption) => Math.max(max, caption.zIndex),
        0
      ) + 1;
    const verticalOffset = Math.min(
      0.68,
      DEFAULT_CAPTION_STYLE.yRatio + activeCaptions.length * 0.1
    );
    setCaptions((prev) => [
      ...prev,
      {
        id: captionId,
        text: '',
        source: 'USER',
        placement: { type: 'CLIP', clipId: activeClipId },
        zIndex: nextZIndex,
        style: { ...DEFAULT_CAPTION_STYLE, yRatio: verticalOffset },
      },
    ]);
    setSelectedCaptionId(captionId);
    setEditingCaptionId(captionId);
    resetCaptionGesture();
  }, [
    activeCaptions,
    activeClipId,
    resetCaptionGesture,
    setCaptions,
    showCaptionStage,
  ]);

  const deleteSelectedCaption = useCallback(() => {
    if (!resolvedSelectedCaptionId) return;
    const remainingActiveCaptions = activeCaptions.filter(
      (caption) => caption.id !== resolvedSelectedCaptionId
    );
    setCaptions((prev) =>
      prev.filter((caption) => caption.id !== resolvedSelectedCaptionId)
    );
    setSelectedCaptionId(remainingActiveCaptions.at(-1)?.id ?? null);
    setEditingCaptionId(null);
    resetCaptionGesture();
  }, [
    activeCaptions,
    resetCaptionGesture,
    resolvedSelectedCaptionId,
    setCaptions,
  ]);

  const distanceBetweenPoints = useCallback(
    (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y),
    []
  );

  const updateGestureCaptionStyle = useCallback(
    (updater: (style: CaptionStyle) => CaptionStyle) => {
      const captionId = captionGestureRef.current.captionId;
      if (!captionId) return;
      updateCaptionById(captionId, (current) => ({
        ...current,
        style: applyClampedCaptionStyle(updater(current.style)),
      }));
    },
    [applyClampedCaptionStyle, updateCaptionById]
  );

  const handleCaptionPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const gesture = captionGestureRef.current;
      if (!gesture.pointerMap.has(event.pointerId)) return;
      gesture.pointerMap.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });

      if (gesture.mode === 'pinch') {
        if (
          !gesture.startStyle ||
          gesture.pointerMap.size < 2 ||
          gesture.startDistance <= 0
        ) {
          return;
        }
        const points = Array.from(gesture.pointerMap.values());
        const nextDistance = distanceBetweenPoints(points[0], points[1]);
        if (!Number.isFinite(nextDistance) || nextDistance <= 0) return;
        const nextScale = clampValue(
          gesture.startScale * (nextDistance / gesture.startDistance),
          MIN_CAPTION_SCALE,
          MAX_CAPTION_SCALE
        );
        updateGestureCaptionStyle(() => ({
          ...gesture.startStyle!,
          scale: nextScale,
        }));
        return;
      }

      if (
        gesture.mode === 'drag' &&
        gesture.dragPointerId === event.pointerId &&
        gesture.startPointer &&
        gesture.startStyle
      ) {
        const interactionRect = getCaptionInteractionRect();
        if (
          !interactionRect ||
          interactionRect.width <= 0 ||
          interactionRect.height <= 0
        ) {
          return;
        }
        const deltaX = event.clientX - gesture.startPointer.x;
        const deltaY = event.clientY - gesture.startPointer.y;
        updateGestureCaptionStyle(() => ({
          ...gesture.startStyle!,
          xRatio:
            gesture.startStyle!.xRatio + deltaX / interactionRect.width,
          yRatio:
            gesture.startStyle!.yRatio + deltaY / interactionRect.height,
        }));
      }
    },
    [
      distanceBetweenPoints,
      getCaptionInteractionRect,
      updateGestureCaptionStyle,
    ]
  );

  const handleCaptionPointerEnd = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const gesture = captionGestureRef.current;
      gesture.pointerMap.delete(event.pointerId);
      const target = event.currentTarget;
      if (target.hasPointerCapture(event.pointerId)) {
        target.releasePointerCapture(event.pointerId);
      }
      if (gesture.pointerMap.size === 0) {
        resetCaptionGesture();
        return;
      }
      if (gesture.mode === 'pinch') {
        if (gesture.pointerMap.size >= 2 && gesture.startStyle) {
          const points = Array.from(gesture.pointerMap.values());
          gesture.startDistance = distanceBetweenPoints(points[0], points[1]);
          const currentCaption = captionsRef.current.find(
            (caption) => caption.id === gesture.captionId
          );
          if (!currentCaption) {
            resetCaptionGesture();
            return;
          }
          gesture.startScale = currentCaption.style.scale;
          gesture.startStyle = { ...currentCaption.style };
          return;
        }
        resetCaptionGesture();
        return;
      }
      if (
        gesture.mode === 'drag' &&
        gesture.dragPointerId === event.pointerId
      ) {
        resetCaptionGesture();
      }
    },
    [captionsRef, distanceBetweenPoints, resetCaptionGesture]
  );

  const handleCaptionPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>, caption: CaptionItem) => {
      if (!showCaptionOverlay) return;
      if (editingCaptionId === caption.id) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.stopPropagation();
      setSelectedCaptionId(caption.id);
      setEditingCaptionId(null);

      const gesture = captionGestureRef.current;
      if (gesture.captionId && gesture.captionId !== caption.id) {
        resetCaptionGesture();
      }
      gesture.captionId = caption.id;
      gesture.pointerMap.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      event.currentTarget.setPointerCapture(event.pointerId);
      if (gesture.pointerMap.size >= 2) {
        if (!gesture.startStyle) {
          gesture.startStyle = { ...caption.style };
        }
        gesture.mode = 'pinch';
        const points = Array.from(gesture.pointerMap.values());
        gesture.startDistance = distanceBetweenPoints(points[0], points[1]);
        gesture.startScale = caption.style.scale;
        return;
      }
      gesture.mode = 'drag';
      gesture.dragPointerId = event.pointerId;
      gesture.startPointer = { x: event.clientX, y: event.clientY };
      gesture.startStyle = { ...caption.style };
    },
    [
      distanceBetweenPoints,
      editingCaptionId,
      resetCaptionGesture,
      showCaptionOverlay,
    ]
  );

  const handleResizeHandlePointerMove = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      const gesture = captionGestureRef.current;
      if (
        gesture.mode !== 'resize' ||
        gesture.dragPointerId !== event.pointerId ||
        !gesture.startStyle ||
        !gesture.startPointer ||
        gesture.startDistance <= 0
      ) {
        return;
      }
      const interactionRect = getCaptionInteractionRect();
      if (
        !interactionRect ||
        interactionRect.width <= 0 ||
        interactionRect.height <= 0
      ) {
        return;
      }
      const center = {
        x:
          interactionRect.left +
          gesture.startStyle.xRatio * interactionRect.width,
        y:
          interactionRect.top +
          gesture.startStyle.yRatio * interactionRect.height,
      };
      const currentDistance = distanceBetweenPoints(center, {
        x: event.clientX,
        y: event.clientY,
      });
      if (!Number.isFinite(currentDistance) || currentDistance <= 0) return;
      const nextScale = clampValue(
        gesture.startScale * (currentDistance / gesture.startDistance),
        MIN_CAPTION_SCALE,
        MAX_CAPTION_SCALE
      );
      updateGestureCaptionStyle(() => ({
        ...gesture.startStyle!,
        scale: nextScale,
      }));
    },
    [
      distanceBetweenPoints,
      getCaptionInteractionRect,
      updateGestureCaptionStyle,
    ]
  );

  const handleResizeHandlePointerEnd = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      const gesture = captionGestureRef.current;
      if (gesture.dragPointerId !== event.pointerId) return;
      const target = event.currentTarget;
      if (target.hasPointerCapture(event.pointerId)) {
        target.releasePointerCapture(event.pointerId);
      }
      resetCaptionGesture();
    },
    [resetCaptionGesture]
  );

  const handleResizeHandlePointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (!showCaptionOverlay || !activeCaptionItem) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.stopPropagation();
      setEditingCaptionId(null);
      const interactionRect = getCaptionInteractionRect();
      if (
        !interactionRect ||
        interactionRect.width <= 0 ||
        interactionRect.height <= 0
      ) {
        return;
      }
      const center = {
        x:
          interactionRect.left +
          activeCaptionStyle.xRatio * interactionRect.width,
        y:
          interactionRect.top +
          activeCaptionStyle.yRatio * interactionRect.height,
      };
      const startPoint = { x: event.clientX, y: event.clientY };
      const gesture = captionGestureRef.current;
      gesture.mode = 'resize';
      gesture.captionId = activeCaptionItem.id;
      gesture.pointerMap.clear();
      gesture.pointerMap.set(event.pointerId, startPoint);
      gesture.dragPointerId = event.pointerId;
      gesture.startPointer = startPoint;
      gesture.startStyle = { ...activeCaptionStyle };
      gesture.startScale = activeCaptionStyle.scale;
      gesture.startDistance = Math.max(
        1,
        distanceBetweenPoints(center, startPoint)
      );
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [
      activeCaptionItem,
      activeCaptionStyle,
      distanceBetweenPoints,
      getCaptionInteractionRect,
      showCaptionOverlay,
    ]
  );

  const handleCaptionTextChange = useCallback(
    (value: string) => updateActiveCaptionText(value),
    [updateActiveCaptionText]
  );

  const handleCaptionToggleBox = useCallback(() => {
    updateActiveCaptionStyle((current) => ({
      ...current,
      boxed: !current.boxed,
    }));
  }, [updateActiveCaptionStyle]);

  const ensureActiveCaptionInFrame = useCallback(() => {
    if (!activeCaptionItem) return;
    const nextStyle = applyClampedCaptionStyle(activeCaptionItem.style);
    if (
      Math.abs(nextStyle.xRatio - activeCaptionItem.style.xRatio) < 0.0001 &&
      Math.abs(nextStyle.yRatio - activeCaptionItem.style.yRatio) < 0.0001 &&
      Math.abs(nextStyle.scale - activeCaptionItem.style.scale) < 0.0001 &&
      nextStyle.boxed === activeCaptionItem.style.boxed
    ) {
      return;
    }
    updateCaptionById(activeCaptionItem.id, (current) => ({
      ...current,
      style: nextStyle,
    }));
  }, [activeCaptionItem, applyClampedCaptionStyle, updateCaptionById]);

  useEffect(() => {
    const frameElement = cameraFrameElement;
    if (!frameElement) return;
    const updateCaptionPreviewScale = () => {
      const rect = frameElement.getBoundingClientRect();
      const nextScale = Math.min(
        rect.width / CAPTION_RENDER_WIDTH,
        rect.height / CAPTION_RENDER_HEIGHT
      );
      if (Number.isFinite(nextScale) && nextScale > 0) {
        setCaptionPreviewScale(nextScale);
      }
    };
    const rafId = window.requestAnimationFrame(updateCaptionPreviewScale);
    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(updateCaptionPreviewScale)
        : null;
    resizeObserver?.observe(frameElement);
    window.addEventListener('resize', updateCaptionPreviewScale);
    return () => {
      window.cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateCaptionPreviewScale);
    };
  }, [cameraFrameElement, stage]);

  useEffect(() => {
    if (!showCaptionOverlay) return;
    const frame = window.requestAnimationFrame(ensureActiveCaptionInFrame);
    return () => window.cancelAnimationFrame(frame);
  }, [
    activeCaptionStyle.boxed,
    activeCaptionStyle.scale,
    activeCaptionStyle.xRatio,
    activeCaptionStyle.yRatio,
    activeCaptionText,
    ensureActiveCaptionInFrame,
    resolvedSelectedCaptionId,
    showCaptionOverlay,
  ]);

  useEffect(() => {
    const handleResize = () => {
      if (!showCaptionOverlay) return;
      ensureActiveCaptionInFrame();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [ensureActiveCaptionInFrame, showCaptionOverlay]);

  useEffect(() => {
    if (
      !editingCaptionId ||
      editingCaptionId !== resolvedSelectedCaptionId
    ) {
      return;
    }
    const input = captionInputRef.current;
    if (!input) return;
    input.focus();
    const valueLength = input.value.length;
    input.setSelectionRange(valueLength, valueLength);
  }, [editingCaptionId, resolvedSelectedCaptionId]);

  return {
    captionStageRef,
    captionOverlayRef,
    captionInputRef,
    captionPreviewScale,
    setSelectedCaptionId,
    editingCaptionId,
    setEditingCaptionId,
    activeCaptions,
    resolvedSelectedCaptionId,
    activeCaptionItem,
    activeCaptionText,
    activeCaptionStyle,
    showCaptionOverlay,
    resetCaptionGesture,
    handleCameraFrameRef,
    updateActiveCaptionText,
    updateActiveCaptionStyle,
    addCaptionToActiveClip,
    deleteSelectedCaption,
    handleCaptionPointerMove,
    handleCaptionPointerEnd,
    handleCaptionPointerDown,
    handleResizeHandlePointerMove,
    handleResizeHandlePointerEnd,
    handleResizeHandlePointerDown,
    handleCaptionTextChange,
    handleCaptionToggleBox,
  };
}
