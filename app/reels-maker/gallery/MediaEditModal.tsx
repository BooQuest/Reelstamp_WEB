'use client';
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react';
import { Play, Pause, X, Check, Info } from 'lucide-react';
import type { EditingMedia, MediaEdit } from './types';
import { floorTenth, setEditDuration } from './geometry';
import SegmentTimeline from './SegmentTimeline';
import useCropGesture from './useCropGesture';
import { generateTimelineThumbnails } from '../utils/media/previews';

type Props = {
  media: EditingMedia;
  busy: boolean;
  canCancel?: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (edit: MediaEdit) => Promise<void>;
};
export default function MediaEditModal({
  media,
  busy,
  canCancel = !busy,
  error,
  onCancel,
  onConfirm,
}: Props) {
  const [edit, setEdit] = useState(media.edit);
  const [input, setInput] = useState(String(media.edit.duration));
  const [validation, setValidation] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [toast, setToast] = useState(false);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const warned = useRef(false);
  const video = useRef<HTMLVideoElement>(null);
  const image = media.item.kind === 'image';
  const max = image ? 3600 : Math.min(3600, floorTenth(media.sourceDuration));
  const pause = () => {
    video.current?.pause();
    setPlaying(false);
  };
  const notifyDuration = () => {
    if (media.isRecommended && !warned.current) {
      warned.current = true;
      setToast(true);
    }
  };
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(false), 3000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (image) return;
    const controller = new AbortController();
    void generateTimelineThumbnails(
      media.item.url,
      {
        duration: media.sourceDuration,
        width: media.width,
        height: media.height,
      },
      controller.signal,
    )
      .then((result) => {
        if (!controller.signal.aborted) setThumbnails(result);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [image, media.item.url, media.sourceDuration, media.width, media.height]);
  const changeDuration = (raw: string) => {
    pause();
    setInput(raw);
    notifyDuration();
    try {
      if (!/^\d+(\.\d)?$/.test(raw))
        throw new Error('길이는 소수점 한 자리까지 입력해 주세요.');
      const next = setEditDuration(
        edit,
        Number(raw),
        image ? 3600 : floorTenth(media.sourceDuration),
      );
      setEdit(next);
      setValidation(null);
    } catch (e) {
      setValidation((e as Error).message);
    }
  };
  const gesture = useCropGesture(
    edit.crop,
    media.width,
    media.height,
    (crop) => {
      if (busy) return;
      pause();
      setEdit((current) => ({ ...current, crop }));
    },
  );
  const style = {
    position: 'absolute' as const,
    width: `${100 / edit.crop.width}%`,
    height: `${100 / edit.crop.height}%`,
    maxWidth: 'none',
    left: `${(-edit.crop.x / edit.crop.width) * 100}%`,
    top: `${(-edit.crop.y / edit.crop.height) * 100}%`,
  };
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="길이 및 화면 조정"
      className="fixed inset-0 z-[90] flex flex-col bg-[#111827] p-3 text-white"
    >
      <p className="shrink-0 py-2 text-center text-sm">
        이동하거나 확대하여 사용할 화면을 선택하세요
      </p>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        <div
          {...gesture}
          className="relative aspect-[9/16] max-h-full touch-none overflow-hidden border border-white/40 bg-black"
          style={{ height: '100%', maxWidth: '100%' }}
        >
          {image ? (
            <img
              src={media.item.url}
              alt="선택한 사진"
              style={style}
              draggable={false}
            />
          ) : (
            <video
              ref={video}
              src={media.item.url}
              style={style}
              playsInline
              preload="metadata"
              onLoadedMetadata={() => {
                if (video.current) video.current.currentTime = edit.start;
              }}
              onTimeUpdate={() => {
                if (
                  video.current &&
                  video.current.currentTime >= edit.start + edit.duration
                ) {
                  pause();
                  video.current.currentTime = edit.start;
                }
              }}
              onEnded={pause}
            />
          )}
        </div>
      </div>
      <div className="mx-auto w-full max-w-xl shrink-0 space-y-3 py-3">
        {!image && (
          <>
            <button
              type="button"
              className="mx-auto block p-2"
              disabled={busy}
              aria-label={
                playing ? '편집 미리보기 일시정지' : '편집 미리보기 재생'
              }
              onClick={async () => {
                if (!video.current) return;
                if (playing) {
                  pause();
                  return;
                }
                video.current.currentTime = edit.start;
                try {
                  await video.current.play();
                  setPlaying(true);
                } catch {
                  setValidation('미리보기를 재생하지 못했습니다.');
                }
              }}
            >
              {playing ? <Pause /> : <Play />}
            </button>
            <SegmentTimeline
              start={edit.start}
              duration={edit.duration}
              sourceDuration={media.sourceDuration}
              thumbnails={thumbnails}
              disabled={busy}
              onChange={(segment) => {
                pause();
                if (segment.duration !== edit.duration) notifyDuration();
                setEdit((current) => ({ ...current, ...segment }));
                setInput(String(segment.duration));
                setValidation(null);
                if (video.current) video.current.currentTime = segment.start;
              }}
            />
          </>
        )}
        <label className="flex items-center justify-center gap-2 text-sm">
          길이
          <input
            aria-label="길이(초)"
            inputMode="decimal"
            value={input}
            onChange={(e) => changeDuration(e.target.value)}
            disabled={busy}
            className="w-24 rounded bg-white/10 p-2 text-center"
          />
          초
        </label>
        <p className="text-center text-xs text-white/60">
          최대 {max.toFixed(1)}초 · 0.1초 단위
        </p>
        {(validation || error) && (
          <p role="alert" className="text-center text-sm text-rose-300">
            {validation || error}
          </p>
        )}
        <div className="flex justify-between">
          <button
            type="button"
            disabled={!canCancel}
            onClick={onCancel}
            className="flex gap-2 rounded bg-white/10 px-4 py-3"
          >
            <X />
            취소
          </button>
          <button
            type="button"
            disabled={busy || Boolean(validation)}
            onClick={() => {
              pause();
              void onConfirm(edit);
            }}
            className="flex gap-2 rounded bg-rose-500 px-4 py-3 disabled:opacity-40"
          >
            <Check />
            {busy ? '적용 중…' : '확인'}
          </button>
        </div>
      </div>
      {toast && (
        <div
          role="status"
          className="pointer-events-none absolute left-4 right-4 top-14 flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-100 px-4 py-3 text-sm font-medium text-rose-900 shadow-lg"
        >
          <Info aria-hidden="true" className="h-5 w-5 shrink-0 text-rose-600" />
          <p>이 템플릿은 권장 길이에 맞춰 제작하는 것을 추천해요.</p>
        </div>
      )}
    </div>
  );
}
