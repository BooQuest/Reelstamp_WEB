'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { CameraPreviewMetrics } from '@/app/reels-maker/utils/camera';

type CameraPreviewVideoProps = {
  stream: MediaStream | null;
  className?: string;
  onPreviewMetrics?: (metrics: CameraPreviewMetrics) => void;
};

export default function CameraPreviewVideo({
  stream,
  className,
  onPreviewMetrics,
}: CameraPreviewVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastMetricsSignatureRef = useRef('');

  const updatePreviewMetrics = useCallback((reason: string) => {
    const video = videoRef.current;
    const frame = video?.parentElement;
    if (!video || !frame) return;

    const rect = frame.getBoundingClientRect();
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    const frameWidth = Math.round(rect.width);
    const frameHeight = Math.round(rect.height);
    const trackSettings =
      stream?.getVideoTracks().map((track) => track.getSettings()) ?? [];

    const signature = `${reason}:${videoWidth}x${videoHeight}:${frameWidth}x${frameHeight}:${JSON.stringify(trackSettings)}`;
    if (lastMetricsSignatureRef.current === signature) return;
    lastMetricsSignatureRef.current = signature;
    onPreviewMetrics?.({
      reason,
      videoWidth,
      videoHeight,
      frameWidth,
      frameHeight,
      objectFit: 'cover',
      trackSettings,
    });
  }, [onPreviewMetrics, stream]);

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
      updatePreviewMetrics('attachStream');
    },
    [stream, updatePreviewMetrics]
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
    lastMetricsSignatureRef.current = '';
    if (videoRef.current) {
      videoRef.current.style.objectFit = 'cover';
    }
  }, [stream]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    let frameId: number | null = null;
    const scheduleUpdate = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        updatePreviewMetrics('scheduled');
      });
    };

    scheduleUpdate();
    const settleTimeoutId = window.setTimeout(scheduleUpdate, 80);
    const lateSettleTimeoutId = window.setTimeout(scheduleUpdate, 240);
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' && video.parentElement
        ? new ResizeObserver(scheduleUpdate)
        : null;

    if (resizeObserver && video.parentElement) {
      resizeObserver.observe(video.parentElement);
    }

    const visualViewport = window.visualViewport;
    const handleLoadedMetadata = () => updatePreviewMetrics('loadedmetadata');
    const handleVideoResize = () => updatePreviewMetrics('video-resize');
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('resize', handleVideoResize);
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('orientationchange', scheduleUpdate);
    visualViewport?.addEventListener('resize', scheduleUpdate);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      window.clearTimeout(settleTimeoutId);
      window.clearTimeout(lateSettleTimeoutId);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('resize', handleVideoResize);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('orientationchange', scheduleUpdate);
      visualViewport?.removeEventListener('resize', scheduleUpdate);
      resizeObserver?.disconnect();
    };
  }, [stream, updatePreviewMetrics]);

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
      style={{ objectFit: 'cover', objectPosition: 'center center' }}
    />
  );
}
