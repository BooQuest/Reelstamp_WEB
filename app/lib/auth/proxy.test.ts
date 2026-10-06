// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('./refresh', () => ({ refreshTokens: refresh }));
beforeEach(() => vi.clearAllMocks());
it('forwards fresh cookies to both the rendering request and browser', async () => {
  refresh.mockResolvedValue({ accessToken: 'new-a', refreshToken: 'new-r', sessionId: 'sid',
    accessTokenExpiresAt: new Date(Date.now()+3600000).toISOString(), refreshTokenExpiresAt: new Date(Date.now()+86400000).toISOString() });
  const response = await proxy(new NextRequest('https://web.test/templates', { headers: { cookie: 'refreshToken=old-r' } }));
  expect(response.cookies.get('accessToken')?.value).toBe('new-a');
  expect(response.headers.get('x-middleware-request-cookie')).toContain('refreshToken=new-r');
});
it.each([401,503,429])('only clears browser cookies for definitive authentication failure (%s)', async status => {
  refresh.mockRejectedValue({ response: { status } });
  const response = await proxy(new NextRequest('https://web.test/templates', { headers: { cookie: 'refreshToken=r' } }));
  expect(response.headers.has('set-cookie')).toBe(status === 401);
  if (status !== 401) expect(response.status).toBe(503);
});
it('leaves API refresh to handlers and rejects cross-origin cookie mutations', async () => {
  await proxy(new NextRequest('https://web.test/api/auth/session', { headers: { cookie: 'refreshToken=r' } }));
  expect(refresh).not.toHaveBeenCalled();
  const response = await proxy(new NextRequest('https://web.test/api/reels-maker/sessions', {
    method: 'POST', headers: { cookie: 'refreshToken=r', origin: 'https://evil.test' },
  }));
  expect(response.status).toBe(403);
});
