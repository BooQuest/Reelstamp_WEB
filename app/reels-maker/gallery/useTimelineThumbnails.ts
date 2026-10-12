'use client';
import { useEffect, useState } from 'react';
import type { VideoMetadata } from '../types';
import { generateTimelineThumbnails } from '../utils/media/previews';
import { timelineWindow } from './timelineGeometry';

type ThumbnailWindow = {
  url: string;
  start: number;
  end: number;
  images: string[];
};

/** Keep one bounded window; retain its time coordinates while the user drags. */
export default function useTimelineThumbnails(
  url: string,
  metadata: VideoMetadata,
  start: number,
  duration: number,
) {
  const [thumbnails, setThumbnails] = useState<ThumbnailWindow | null>(null);
  const { width, height, duration: sourceDuration } = metadata;
  const window = timelineWindow(start, duration, sourceDuration);

  useEffect(() => {
    const controller = new AbortController();
    const range = { start: window.start, end: window.end };
    const timer = setTimeout(() => {
      void generateTimelineThumbnails(
        url,
        { width, height, duration: sourceDuration },
        controller.signal,
        range,
      ).then((images) => {
        if (!controller.signal.aborted) setThumbnails({ url, ...range, images });
      }).catch(() => {
        // Missing thumbnails must not block selecting or saving a segment.
      });
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [url, width, height, sourceDuration, window.start, window.end]);

  return thumbnails?.url === url ? thumbnails : null;
}
