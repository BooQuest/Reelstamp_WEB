'use client';

import { useCallback, useEffect, useRef } from 'react';

type CameraPreviewVideoProps = {
  stream: MediaStream | null;
  className?: string;
};

export default function CameraPreviewVideo({
  stream,
  className,
}: CameraPreviewVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const attachStream = useCallback(
    (video: HTMLVideoElement | null) => {
      if (!video) return;

      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }

      if (stream) {
        const playPromise = video.play();
        if (playPromise) {
          playPromise.catch(() => {
            // Autoplay can be blocked on some mobile browsers.
          });
        }
      }
    },
    [stream]
  );

  const handleVideoRef = useCallback(
    (node: HTMLVideoElement | null) => {
      if (videoRef.current && videoRef.current !== node) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }

      videoRef.current = node;
      attachStream(node);
    },
    [attachStream]
  );

  useEffect(() => {
    attachStream(videoRef.current);
  }, [attachStream]);

  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  return (
    <video
      ref={handleVideoRef}
      autoPlay
      playsInline
      muted
      className={className}
    />
  );
}
