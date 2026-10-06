// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { validateOAuthExchange } from './oauth-state';
const { store } = vi.hoisted(() => ({ store: { get: vi.fn(), delete: vi.fn() } }));
vi.mock('next/headers', () => ({ cookies: async () => store }));
const request = (origin='https://web.test') => new NextRequest('https://web.test/api/auth/google-token', { method: 'POST', headers: { origin } });
beforeEach(() => { vi.clearAllMocks(); store.get.mockReturnValue({ value: 'GOOGLE:nonce' }); });
it.each([undefined,'','other'])('rejects missing/mismatched state %s', async state => {
  await expect(validateOAuthExchange(request(),'GOOGLE',state)).rejects.toMatchObject({ response: { status: 403 } });
  expect(store.delete).not.toHaveBeenCalled();
});
it('binds provider and origin and rejects external redirects', async () => {
  await expect(validateOAuthExchange(request(),'KAKAO','nonce')).rejects.toThrow();
  await expect(validateOAuthExchange(request('https://evil.test'),'GOOGLE','nonce')).rejects.toThrow();
  await expect(validateOAuthExchange(request(),'GOOGLE','nonce','https://evil.test/login')).rejects.toThrow();
  await validateOAuthExchange(request(),'GOOGLE','nonce','https://web.test/login');
  expect(store.delete).toHaveBeenCalledOnce();
});
