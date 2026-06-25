'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';

type FixedClipVideoProps = {
  clipUrl: string;
  posterUrl?: string;
  className?: string;
};

export default function FixedClipVideo({
  clipUrl,
  posterUrl,
  className,
}: FixedClipVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);

  const handleVideoRef = useCallback((node: HTMLVideoElement | null) => {
    if (videoRef.current && videoRef.current !== node) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    videoRef.current = node;

    if (node) {
      node.srcObject = null;
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
      try {
        video.currentTime = 0;
      } catch {
        // Metadata may not be ready yet on some mobile browsers.
      }
    }
  }, [clipUrl]);

  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  const handlePlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    if (hasEnded || video.ended) {
      try {
        video.currentTime = 0;
      } catch {
        // Keep playback attempt graceful if seek fails.
      }
      setHasEnded(false);
    }

    try {
      await video.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  }, [hasEnded]);

  const handlePause = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.paused) return;

    video.pause();
    setIsPlaying(false);
    setHasEnded(false);
  }, []);

  return (
    <>
      <video
        key={clipUrl}
        ref={handleVideoRef}
        src={clipUrl}
        muted
        playsInline
        preload="metadata"
        poster={posterUrl}
        onClick={() => {
          if (isPlaying) {
            handlePause();
          }
        }}
        onPlay={() => {
          setIsPlaying(true);
          setHasEnded(false);
        }}
        onPause={() => {
          setIsPlaying(false);
          if (!videoRef.current?.ended) {
            setHasEnded(false);
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          setHasEnded(true);
        }}
        className={`${className ?? ''} ${isPlaying ? 'cursor-pointer' : ''}`}
      />
      {!isPlaying && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            void handlePlay();
          }}
          className="absolute left-1/2 top-1/2 z-20 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center text-white transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          aria-label="고정 영상 재생"
        >
          <Play
            className="h-16 w-16 fill-white text-white drop-shadow-[0_4px_14px_rgba(0,0,0,0.55)]"
            strokeWidth={1.5}
          />
        </button>
      )}
    </>
  );
}
