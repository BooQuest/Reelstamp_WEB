'use client';
/* eslint-disable @next/next/no-img-element */
import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type Ref,
} from 'react';
import type { ClipInfo, CropRegion } from '../types';

export type ClipPlayerHandle = {
  currentTime: number;
  readonly paused: boolean;
  readonly ended: boolean;
  play: () => Promise<void>;
  pause: () => void;
};
type Event = { currentTarget: ClipPlayerHandle };
type Props = {
  clip: ClipInfo;
  ref?: Ref<ClipPlayerHandle>;
  className?: string;
  'aria-label'?: string;
  thumbnail?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onLoadedMetadata?: (event: Event) => void;
  onTimeUpdate?: (event: Event) => void;
};
export function cropStyle(crop?: CropRegion) {
  return crop
    ? {
        position: 'absolute' as const,
        maxWidth: 'none',
        width: `${100 / crop.width}%`,
        height: `${100 / crop.height}%`,
        left: `${(-crop.x / crop.width) * 100}%`,
        top: `${(-crop.y / crop.height) * 100}%`,
      }
    : undefined;
}
export default function ClipPlayer(props: Props) {
  const { clip, thumbnail } = props;
  const video = useRef<HTMLVideoElement>(null);
  const current = useRef(props);
  current.current = props;
  const time = useRef(0);
  const playing = useRef(false);
  const [failure, setFailure] = useState(false);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const handle = useMemo<ClipPlayerHandle>(
    () => ({
      get currentTime() {
        return time.current;
      },
      set currentTime(value) {
        const active = current.current.clip;
        time.current = Math.max(0, Math.min(active.duration, value));
        if (video.current)
          video.current.currentTime = (active.edit?.start ?? 0) + time.current;
      },
      get paused() {
        return !playing.current;
      },
      get ended() {
        return time.current >= current.current.clip.duration;
      },
      async play() {
        if (time.current >= current.current.clip.duration) this.currentTime = 0;
        if (video.current) await video.current.play();
        else {
          playing.current = true;
          current.current.onPlay?.();
        }
      },
      pause() {
        video.current?.pause();
        playing.current = false;
        current.current.onPause?.();
      },
    }),
    [],
  );
  useImperativeHandle(props.ref, () => handle, [handle]);
  useEffect(() => {
    time.current = 0;
    playing.current = false;
    let previous = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      if (playing.current) {
        const active = current.current.clip;
        time.current = video.current
          ? Math.max(0, video.current.currentTime - (active.edit?.start ?? 0))
          : Math.min(active.duration, time.current + (now - previous) / 1000);
        current.current.onTimeUpdate?.({ currentTarget: handle });
        if (time.current >= active.duration) {
          handle.pause();
          current.current.onEnded?.();
        }
      }
      previous = now;
      frame = requestAnimationFrame(tick);
    };
    if (!thumbnail) frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      playing.current = false;
    };
  }, [clip.url, clip.edit?.start, clip.duration, thumbnail, handle]);
  useEffect(() => {
    if (ready || failure) return;
    const timeout = setTimeout(() => setFailure(true), 20000);
    return () => clearTimeout(timeout);
  }, [ready, failure, attempt]);
  const loaded = () => {
    setReady(true);
    handle.currentTime = time.current;
    props.onLoadedMetadata?.({ currentTarget: handle });
  };
  const mediaStyle = cropStyle(clip.edit?.crop);
  return (
    <div
      className={props.className ?? 'absolute inset-0 overflow-hidden'}
      style={
        thumbnail ? { display: 'flex', justifyContent: 'center' } : undefined
      }
    >
      <div
        className={
          thumbnail
            ? 'relative h-full aspect-[9/16] shrink-0 overflow-hidden'
            : 'absolute inset-0 overflow-hidden'
        }
      >
        {clip.kind === 'image' ? (
          <img
            key={`${clip.url}:${attempt}`}
            src={clip.url}
            alt={thumbnail ? '' : props['aria-label'] || '컷 사진 미리보기'}
            aria-label={thumbnail ? undefined : '컷 사진 미리보기'}
            style={mediaStyle}
            className="h-full w-full object-contain"
            onLoad={loaded}
            onError={() => setFailure(true)}
          />
        ) : (
          <video
            key={`${clip.url}:${attempt}`}
            ref={video}
            src={clip.url}
            playsInline
            muted={thumbnail}
            preload={thumbnail ? 'metadata' : 'auto'}
            aria-label={
              thumbnail ? undefined : props['aria-label'] || '컷 영상 미리보기'
            }
            style={mediaStyle}
            className="h-full w-full object-contain"
            onLoadedMetadata={() => {
              if (video.current)
                video.current.currentTime =
                  (clip.edit?.start ?? 0) + time.current;
            }}
            onLoadedData={loaded}
            onError={() => setFailure(true)}
            onPlay={() => {
              playing.current = true;
              props.onPlay?.();
            }}
            onPause={() => {
              playing.current = false;
              props.onPause?.();
            }}
            onEnded={() => {
              time.current = clip.duration;
              handle.pause();
              props.onEnded?.();
            }}
          />
        )}
      </div>
      {!thumbnail && failure && (
        <div
          role="alert"
          className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 p-4 text-sm"
        >
          <p>미리보기를 불러오지 못했습니다. 편집 내용은 유지됩니다.</p>
          <button
            type="button"
            className="mt-3 rounded bg-white/20 p-2"
            onClick={() => {
              setFailure(false);
              setReady(false);
              setAttempt((a) => a + 1);
            }}
          >
            다시 불러오기
          </button>
        </div>
      )}
      {!thumbnail && !ready && !failure && (
        <p className="pointer-events-none absolute inset-x-0 top-3 text-center text-xs">
          미리보기 준비 중…
        </p>
      )}
    </div>
  );
}
