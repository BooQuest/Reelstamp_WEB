'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type RefObject } from 'react';
import type { MakerCut, SubmitClip, VideoDebugLogger } from '../types';
import { DEFAULT_GALLERY_CLIP_DURATION_SECONDS } from '../constants';
import { imageToVideoBlob } from '../utils/media/imageVideo';
import { getErrorMessage } from '../utils/errors';

type FilePickerAcceptOption = {
  description?: string;
  accept: Record<string, string[]>;
};

type FileSystemFileHandleLike = {
  getFile: () => Promise<File>;
};

type WindowWithOpenFilePicker = Window & {
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    excludeAcceptAllOption?: boolean;
    types?: FilePickerAcceptOption[];
  }) => Promise<FileSystemFileHandleLike[]>;
};

const GALLERY_FILE_PICKER_TYPES: FilePickerAcceptOption[] = [
  {
    description: '사진 또는 영상',
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.heic'],
      'video/*': ['.mp4', '.mov', '.webm', '.m4v'],
    },
  },
];

type Options = {
  cuts: MakerCut[];
  activeCutIndex: number;
  onSelectCut: (index: number) => void;
  onBeforePick: () => void;
  onOpenVideo: (file: File, index: number) => Promise<void>;
  onSubmit: SubmitClip;
  logVideoDebug: VideoDebugLogger;
};

export default function useGalleryImport({ cuts, activeCutIndex, onSelectCut, onBeforePick, onOpenVideo, onSubmit, logVideoDebug }: Options) {
  const galleryFileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaPickerTargetIndexRef = useRef<number | null>(null);
  const mediaPickerFocusTimeoutRef = useRef<number | null>(null);
  const pickerFocusListenerRef = useRef<(() => void) | null>(null);
  const operationRef = useRef(0);
  const conversionRef = useRef<AbortController | null>(null);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [isGalleryProcessing, setIsGalleryProcessing] = useState(false);
  const [isMediaPickerActive, setIsMediaPickerActive] = useState(false);

  const disposePicker = useCallback(() => {
    if (mediaPickerFocusTimeoutRef.current !== null) {
      window.clearTimeout(mediaPickerFocusTimeoutRef.current);
      mediaPickerFocusTimeoutRef.current = null;
    }
    if (pickerFocusListenerRef.current) {
      window.removeEventListener('focus', pickerFocusListenerRef.current);
      pickerFocusListenerRef.current = null;
    }
  }, []);
  const finishMediaPicker = useCallback(() => {
    disposePicker();
    setIsMediaPickerActive(false);
  }, [disposePicker]);
  const clearError = useCallback(() => setGalleryError(null), []);
  const reset = useCallback(() => {
    operationRef.current += 1;
    conversionRef.current?.abort();
    conversionRef.current = null;
    disposePicker();
    mediaPickerTargetIndexRef.current = null;
    setIsMediaPickerActive(false);
    setIsGalleryProcessing(false);
    setGalleryError(null);
    if (galleryFileInputRef.current) galleryFileInputRef.current.value = '';
  }, [disposePicker]);
  useEffect(() => () => {
    operationRef.current += 1;
    conversionRef.current?.abort();
    conversionRef.current = null;
    disposePicker();
  }, [disposePicker]);

  const handleSelectedMediaFile = useCallback(async (file: File, targetIndex: number) => {
    const targetCut = cuts[targetIndex];
    if (!targetCut || targetCut.isFixed) return;
    const operation = operationRef.current;
    onSelectCut(targetIndex);
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isImage) {
      setGalleryError('사진 또는 영상 파일만 선택할 수 있습니다.');
      return;
    }
    setGalleryError(null);
    if (isImage) {
      const controller = new AbortController();
      conversionRef.current = controller;
      setIsGalleryProcessing(true);
      try {
        const seconds = Math.max(0, targetCut.durationSeconds ?? 0);
        const converted = await imageToVideoBlob(file, seconds > 0 ? seconds : DEFAULT_GALLERY_CLIP_DURATION_SECONDS, logVideoDebug, controller.signal);
        if (operation !== operationRef.current) return;
        await onSubmit(targetIndex, converted, 'file');
      } catch (error) {
        if (operation !== operationRef.current || (error instanceof DOMException && error.name === 'AbortError')) return;
        const message = getErrorMessage(error, '사진을 영상으로 변환하지 못했습니다.');
        setGalleryError(message);
        alert(message);
      } finally {
        if (conversionRef.current === controller) conversionRef.current = null;
        if (operation === operationRef.current) setIsGalleryProcessing(false);
      }
      return;
    }
    await onOpenVideo(file, targetIndex);
  }, [cuts, onSelectCut, onSubmit, onOpenVideo, logVideoDebug]);

  const handleGalleryFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file) { finishMediaPicker(); return; }
    const operation = operationRef.current;
    const targetIndex = mediaPickerTargetIndexRef.current ?? activeCutIndex;
    try { await handleSelectedMediaFile(file, targetIndex); }
    finally { if (operation === operationRef.current) finishMediaPicker(); }
  }, [activeCutIndex, finishMediaPicker, handleSelectedMediaFile]);
  const openFallbackFilePicker = useCallback(
    (inputRef: RefObject<HTMLInputElement | null>, targetIndex: number) => {
      mediaPickerTargetIndexRef.current = targetIndex;
      onBeforePick();
      setIsMediaPickerActive(true);

      if (mediaPickerFocusTimeoutRef.current) {
        window.clearTimeout(mediaPickerFocusTimeoutRef.current);
      }
      const handlePickerFocus = () => {
        mediaPickerFocusTimeoutRef.current = window.setTimeout(() => {
          finishMediaPicker();
        }, 400);
      };
      pickerFocusListenerRef.current = handlePickerFocus;
      window.addEventListener('focus', handlePickerFocus, { once: true });

      try {
        const input = inputRef.current;
        if (!input) {
          window.removeEventListener('focus', handlePickerFocus);
          finishMediaPicker();
          return;
        }
        input.click();
      } catch {
        window.removeEventListener('focus', handlePickerFocus);
        finishMediaPicker();
      }
    },
    [finishMediaPicker, onBeforePick]
  );

  const open = useCallback(async (targetIndex: number) => {
    const operation = operationRef.current;
    clearError();
    mediaPickerTargetIndexRef.current = targetIndex;
    onBeforePick();

    const pickerWindow = window as WindowWithOpenFilePicker;
    if (!pickerWindow.showOpenFilePicker) {
      openFallbackFilePicker(galleryFileInputRef, targetIndex);
      return;
    }

    setIsMediaPickerActive(true);
    try {
      const [fileHandle] = await pickerWindow.showOpenFilePicker({
        multiple: false,
        excludeAcceptAllOption: true,
        types: GALLERY_FILE_PICKER_TYPES,
      });
      if (operation !== operationRef.current) return;
      const file = await fileHandle?.getFile();
      if (file && operation === operationRef.current) {
        await handleSelectedMediaFile(file, targetIndex);
      }
    } catch (error: unknown) {
      const isAbortError =
        error instanceof DOMException && error.name === 'AbortError';
      if (!isAbortError && operation === operationRef.current) {
        const message = getErrorMessage(error, '파일을 선택하지 못했습니다.');
        setGalleryError(message);
      }
    } finally {
      if (operation === operationRef.current) finishMediaPicker();
    }
  }, [clearError, finishMediaPicker, handleSelectedMediaFile, onBeforePick, openFallbackFilePicker]);

  return { galleryFileInputRef, galleryError, isGalleryProcessing, isMediaPickerActive, handleGalleryFileChange, open, reset, clearError };
}
