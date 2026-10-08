import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { installObjectUrls } from '../test/fixtures';
import useMediaSources from './useMediaSources';
import type { MediaAsset } from './types';

const asset: MediaAsset = {
  id: 'asset',
  name: 'photo.jpg',
  kind: 'image',
  contentType: 'image/jpeg',
  duration: null,
  width: 1080,
  height: 1920,
  sizeBytes: 5,
  downloadUrl: 'https://media.test/source',
};
beforeEach(installObjectUrls);
describe('editing source ownership', () => {
  it('keeps referenced editing URLs and releases unused URLs once', () => {
    const { result, unmount } = renderHook(useMediaSources);
    const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
    const first = result.current.fromFile(file);
    const second = result.current.fromFile(file);
    result.current.retain(new Set([second.url]));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(first.url);
    result.current.release(first.url);
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(second.url);
  });
  it('restores originals using an owned streaming endpoint without downloading a blob', async () => {
    const { result, unmount } = renderHook(useMediaSources);
    const source = await result.current.fromAsset(asset, new AbortController().signal, 1);
    expect(source.url).toBe('/api/reels-maker/sessions/1/media?assetId=asset');
    expect(source.asset).toEqual(asset); expect(source.file).toBeUndefined();
    unmount(); expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });
});
