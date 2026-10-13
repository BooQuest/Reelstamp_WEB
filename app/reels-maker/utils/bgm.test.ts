import { describe, expect, it } from 'vitest';
import { resolveRecommendedBgm } from './bgm';

describe('recommended BGM', () => {
  it('normalizes the audio URL without converting its large ID to a number', () => {
    expect(resolveRecommendedBgm('  오리지널 오디오  ', 'https://instagram.com/reels/audio/28388098380857597?igsh=test'))
      .toEqual({ title: '오리지널 오디오', url: 'https://www.instagram.com/reels/audio/28388098380857597/' });
  });

  it.each([
    [undefined, undefined], [null, null], ['', 'https://www.instagram.com/reels/audio/123/'],
    ['   ', 'https://www.instagram.com/reels/audio/123/'], ['Song', null], ['Song', ''],
    ['Song', 'not a URL'], ['Song', 'javascript:alert(1)'],
    ['Song', 'http://www.instagram.com/reels/audio/123/'],
    ['Song', 'https://www.instagram.com.evil.test/reels/audio/123/'],
    ['Song', 'https://user:password@www.instagram.com/reels/audio/123/'],
    ['Song', 'https://www.instagram.com:8443/reels/audio/123/'],
    ['Song', 'https://www.instagram.com/reel/Dd66Hv1Rgs7/'],
    ['Song', 'https://www.instagram.com/reels/audio/not-an-id/'],
  ])('hides missing or unsupported recommendation: %s, %s', (title, url) => {
    expect(resolveRecommendedBgm(title, url)).toBeNull();
  });
});
