'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

type CapturedClipPreviewProps = {
  clipUrl: string;
  posterUrl?: string;
};

const resetVideoToStart = (video: HTMLVideoElement) => {
  video.pause();
  try {
    video.currentTime = 0;
  } catch {
    // Metadata may not be ready yet on some mobile browsers.
  }
};

export default function CapturedClipPreview({
  clipUrl,
  posterUrl,
}: CapturedClipPreviewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      resetVideoToStart(video);
    }
  }, [clipUrl]);

  const handleToggle = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    if (!video.paused && !video.ended) {
      video.pause();
      setIsPlaying(false);
      return;
    }

    if (video.ended) {
      try {
        video.currentTime = 0;
      } catch {
        // Keep playback attempt graceful if seek fails.
      }
    }

    try {
      const playPromise = video.play();
      if (playPromise) {
        await playPromise;
      }
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  }, []);

  return (
    <>
      <video
        ref={videoRef}
        key={clipUrl}
        src={clipUrl}
        playsInline
        preload="metadata"
        poster={posterUrl}
        className="absolute inset-0 h-full w-full object-cover"
        onClick={handleToggle}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          const video = videoRef.current;
          if (video) {
            resetVideoToStart(video);
          }
        }}
      />
      <button
        type="button"
        onClick={handleToggle}
        className={`absolute left-1/2 top-1/2 z-[21] flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/55 text-white shadow-xl backdrop-blur transition ${
          isPlaying ? 'opacity-0 hover:opacity-100 focus-visible:opacity-100' : 'opacity-100'
        }`}
        aria-label={isPlaying ? '촬영 컷 미리보기 일시정지' : '촬영 컷 미리보기 재생'}
      >
        {isPlaying ? <Pause className="h-7 w-7" /> : <Play className="ml-0.5 h-7 w-7" />}
      </button>
    </>
  );
}
