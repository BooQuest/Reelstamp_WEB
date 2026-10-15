import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { requireCreationLocale, templateLocale } from './api-locale';
vi.mock('next/headers', () => ({ cookies: async () => ({get: () => undefined}) }));
afterEach(() => vi.unstubAllEnvs());
it('defaults to Korean, validates explicit locale, and enforces the server flag', async () => {
  vi.stubEnv('REELSTAMP_ENGLISH_ENABLED', 'false');
  expect(await templateLocale(new NextRequest('https://test.local/api/templates'))).toBe('ko');
  await expect(templateLocale(new NextRequest('https://test.local/api/templates?locale=en'))).rejects.toMatchObject({response:{status:404,data:{errorCode:'ENGLISH_NOT_ENABLED'}}});
  await expect(templateLocale(new NextRequest('https://test.local/api/templates?locale=fr'))).rejects.toMatchObject({response:{status:400}});
  expect(() => requireCreationLocale('en')).toThrow();
  expect(requireCreationLocale(undefined)).toBe('ko');
  vi.stubEnv('REELSTAMP_ENGLISH_ENABLED','true');
  expect(await templateLocale(new NextRequest('https://test.local/api/templates?locale=en'))).toBe('en');
  expect(requireCreationLocale('en')).toBe('en');
});
