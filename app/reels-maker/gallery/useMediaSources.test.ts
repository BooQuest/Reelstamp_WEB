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
  it('reuses an uploaded asset after releasing its temporary editing URL', () => {
    const { result, unmount } = renderHook(useMediaSources);
    const file = new File(['photo'], 'photo.jpg', {
      type: 'image/jpeg',
      lastModified: 1,
    });
    const first = result.current.fromFile(file);
    result.current.associate(first.key, asset);
    result.current.release(first.url);
    const second = result.current.fromFile(file);
    expect(second.asset).toEqual(asset);
    expect(second.url).not.toBe(first.url);
    result.current.release(first.url);
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(second.url);
  });
  it('does not retain asset associations after leaving the project', () => {
    const first = renderHook(useMediaSources);
    const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
    const source = first.result.current.fromFile(file);
    first.result.current.associate(source.key, asset);
    first.unmount();
    const second = renderHook(useMediaSources);
    expect(second.result.current.fromFile(file).asset).toBeUndefined();
    second.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });
});
