'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { MediaAsset, MediaSource } from './types';

// Keep uploaded asset identities without keeping a visible library or retaining local files.
export default function useMediaSources() {
  const urls = useRef(new Set<string>());
  const release = useCallback((url: string) => {
    if (urls.current.delete(url)) URL.revokeObjectURL(url);
  }, []);
  useEffect(() => {
    const ownedUrls = urls.current;
    return () => {
      ownedUrls.forEach((url) => URL.revokeObjectURL(url));
      ownedUrls.clear();
    };
  }, []);
  const create = (file: File, key: string, asset?: MediaAsset): MediaSource => {
    const url = URL.createObjectURL(file);
    urls.current.add(url);
    return {
      key,
      name: file.name,
      kind: file.type.startsWith('image/') ? 'image' : 'video',
      url,
      file,
      asset,
    };
  };
  return {
    release,
    retain: (retained: Set<string>) => { for (const url of urls.current) if (!retained.has(url)) release(url); },
    fromFile: (file: File) => {
      const key = JSON.stringify([
        file.name,
        file.size,
        file.lastModified,
        file.type,
      ]);
      return create(file, key);
    },
    fromAsset: async (asset: MediaAsset, _signal: AbortSignal, sessionId: number) => ({
      key: asset.id, name: asset.name, kind: asset.kind,
      url: `/api/reels-maker/sessions/${sessionId}/media?assetId=${encodeURIComponent(asset.id)}`, asset,
    } as MediaSource),
  };
}
