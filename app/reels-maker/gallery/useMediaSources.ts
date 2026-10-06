'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { MediaAsset, MediaSource } from './types';

// Keep uploaded asset identities without keeping a visible library or retaining local files.
export default function useMediaSources() {
  const assets = useRef(new Map<string, MediaAsset>());
  const urls = useRef(new Set<string>());
  const release = useCallback((url: string) => {
    if (urls.current.delete(url)) URL.revokeObjectURL(url);
  }, []);
  useEffect(() => {
    const ownedUrls = urls.current;
    const knownAssets = assets.current;
    return () => {
      ownedUrls.forEach((url) => URL.revokeObjectURL(url));
      ownedUrls.clear();
      knownAssets.clear();
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
    fromFile: (file: File) => {
      const key = JSON.stringify([
        file.name,
        file.size,
        file.lastModified,
        file.type,
      ]);
      return create(file, key, assets.current.get(key));
    },
    fromAsset: async (asset: MediaAsset, signal: AbortSignal) => {
      const response = await fetch(
        `/api/reels-maker/download?url=${encodeURIComponent(asset.downloadUrl)}`,
        { signal },
      );
      if (!response.ok)
        throw new Error('원본을 불러오지 못했습니다. 다시 시도해 주세요.');
      const blob = await response.blob();
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      return create(
        new File([blob], asset.name, { type: asset.contentType || blob.type }),
        asset.id,
        asset,
      );
    },
    associate: (key: string, asset: MediaAsset) => {
      assets.current.set(key, asset);
    },
  };
}
