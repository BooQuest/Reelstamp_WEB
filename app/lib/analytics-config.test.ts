import { afterEach, expect, it } from 'vitest';
import { GOOGLE_TAG_INIT } from './analytics-config';
afterEach(() => window.history.replaceState({}, '', '/'));
it.each(['/login?code=one-use-code&state=opaque', '/login?error=access_denied&state=opaque'])('does not send OAuth query credentials to Analytics for %s', path => {
  window.history.replaceState({}, '', path);
  const target = window as unknown as { dataLayer: IArguments[] };
  target.dataLayer = [];
  new Function(GOOGLE_TAG_INIT)();
  expect(target.dataLayer.map(args => args[0])).not.toContain('config');
});
it('keeps normal page Analytics initialization', () => {
  window.history.replaceState({}, '', '/account/delete');
  const target = window as unknown as { dataLayer: IArguments[] };
  target.dataLayer = []; new Function(GOOGLE_TAG_INIT)();
  expect(target.dataLayer.map(args => args[0])).toContain('config');
});
