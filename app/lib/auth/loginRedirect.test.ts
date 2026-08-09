import { describe, expect, it } from 'vitest';
import {
  buildLoginReturnHref,
  buildLoginOauthState,
  getSafeLoginReturnUrl,
  parseLoginOauthState,
} from './loginRedirect';

describe('login redirect helpers', () => {
  it('allows only internal non-login return urls', () => {
    expect(getSafeLoginReturnUrl('/pricing')).toBe('/pricing');
    expect(getSafeLoginReturnUrl('/reels-maker?templateId=tpl-1')).toBe(
      '/reels-maker?templateId=tpl-1'
    );
    expect(getSafeLoginReturnUrl('https://example.com')).toBeNull();
    expect(getSafeLoginReturnUrl('//example.com')).toBeNull();
    expect(getSafeLoginReturnUrl('/login?returnUrl=/pricing')).toBeNull();
  });

  it('preserves returnUrl inside oauth state', () => {
    const state = buildLoginOauthState('google', 'nonce', '/pricing');

    expect(state).toBe('google_nonce.%2Fpricing');
    expect(parseLoginOauthState(state)).toEqual({
      provider: 'GOOGLE',
      returnUrl: '/pricing',
    });
  });

  it('builds login hrefs with encoded returnUrl', () => {
    expect(buildLoginReturnHref('/reels-maker?templateId=tpl-1')).toBe(
      '/login?returnUrl=%2Freels-maker%3FtemplateId%3Dtpl-1'
    );
  });

  it('ignores unsafe returnUrl inside oauth state', () => {
    const state = buildLoginOauthState('naver', 'nonce', 'https://example.com');

    expect(state).toBe('naver_nonce');
    expect(parseLoginOauthState('naver_nonce.https%3A%2F%2Fexample.com')).toEqual({
      provider: 'NAVER',
      returnUrl: null,
    });
  });
});
