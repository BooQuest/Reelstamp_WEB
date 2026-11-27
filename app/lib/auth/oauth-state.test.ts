// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { validateOAuthExchange } from './oauth-state';
const { store } = vi.hoisted(() => ({ store: { get: vi.fn(), delete: vi.fn() } }));
vi.mock('next/headers', () => ({ cookies: async () => store }));
const request = (origin='https://web.test') => new NextRequest('https://web.test/api/auth/google-token', { method: 'POST', headers: { origin } });
const nonce = 'n'.repeat(43);
beforeEach(() => { vi.clearAllMocks(); store.get.mockReturnValue({ value: `GOOGLE:${nonce}:state` }); });
it.each([undefined,'','other'])('rejects missing/mismatched state %s', async state => {
  await expect(validateOAuthExchange(request(),'GOOGLE',state)).rejects.toMatchObject({ response: { status: 403 } });
  expect(store.delete).not.toHaveBeenCalled();
});
it('binds provider and origin and rejects external redirects', async () => {
  await expect(validateOAuthExchange(request(),'KAKAO','state')).rejects.toThrow();
  await expect(validateOAuthExchange(request('https://evil.test'),'GOOGLE','state')).rejects.toThrow();
  await expect(validateOAuthExchange(request(),'GOOGLE','state','https://evil.test/login')).rejects.toThrow();
  await expect(validateOAuthExchange(request(),'GOOGLE','state','https://web.test/login')).resolves.toBe(nonce);
  expect(store.delete).toHaveBeenCalledOnce();
});

it('rejects a pre-release Google state cookie without a nonce', async () => {
  store.get.mockReturnValue({ value: 'GOOGLE:state' });
  await expect(validateOAuthExchange(request(), 'GOOGLE', 'state', 'https://web.test/login'))
    .rejects.toMatchObject({ response: { status: 403 } });
  expect(store.delete).not.toHaveBeenCalled();
});

it.each(['KAKAO', 'NAVER'])('honors the original %s cookie format', async provider => {
  store.get.mockReturnValue({ value: `${provider}:state` });
  await expect(validateOAuthExchange(request(), provider, 'state')).resolves.toBeUndefined();
  expect(store.delete).toHaveBeenCalledOnce();
});
