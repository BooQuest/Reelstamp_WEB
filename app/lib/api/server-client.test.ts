// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, type AxiosResponse } from 'axios';
import { getMutableServerApiClient, getServerApiClient } from './server-client';
const { store, refresh } = vi.hoisted(() => ({ store: { get: vi.fn(), set: vi.fn(), delete: vi.fn() }, refresh: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => store, headers: async () => new Headers() }));
vi.mock('@/app/lib/auth/refresh', () => ({ refreshTokens: refresh }));
const jwt = (seconds: number) => `x.${Buffer.from(JSON.stringify({ type: 'ACCESS', sid: 'id', exp: Date.now() / 1000 + seconds })).toString('base64url')}.x`;
const renewed = () => ({ accessToken: jwt(3600), refreshToken: 'new-r', sessionId: 'id', expiresIn: 3600,
  accessTokenExpiresAt: new Date(Date.now()+3600000).toISOString(), refreshTokenExpiresAt: new Date(Date.now()+86400000).toISOString() });
beforeEach(() => { vi.clearAllMocks(); store.get.mockImplementation(name => name === 'refreshToken' ? { value: 'old-r' } : undefined); });
describe('cookie-writing contexts', () => {
  it('refreshes before the business call and sends the refreshed access token', async () => {
    const token = renewed(); refresh.mockResolvedValue(token);
    const api = await getMutableServerApiClient();
    const adapter = vi.fn(async config => ({ data: {}, status: 200, statusText: '', headers: {}, config }) as AxiosResponse);
    api.defaults.adapter = adapter; await api.post('/operation', { data: 1 });
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(adapter.mock.calls[0][0].headers.Authorization).toBe(`Bearer ${token.accessToken}`);
    expect(store.set).toHaveBeenCalledTimes(2);
  });
  it('never rotates or changes cookies from server rendering', async () => {
    const api = await getServerApiClient(); const adapter = vi.fn(); api.defaults.adapter = adapter;
    await expect(api.get('/private')).rejects.toMatchObject({ response: { status: 401 } });
    expect(refresh).not.toHaveBeenCalled(); expect(store.set).not.toHaveBeenCalled(); expect(adapter).not.toHaveBeenCalled();
  });
  it.each([401,503])('only clears credentials on definitive %s failure', async status => {
    refresh.mockRejectedValue({ response: { status } });
    const api = await getMutableServerApiClient(); const adapter = vi.fn(); api.defaults.adapter = adapter;
    await expect(api.get('/private')).rejects.toMatchObject({ response: { status } });
    expect(store.delete).toHaveBeenCalledTimes(status === 401 ? 2 : 0); expect(adapter).not.toHaveBeenCalled();
  });
  it('does not replay a business mutation following an ambiguous network error', async () => {
    store.get.mockImplementation(name => ({ value: name === 'accessToken' ? jwt(3600) : 'r' }));
    const api = await getMutableServerApiClient(); const adapter = vi.fn().mockRejectedValue(new AxiosError('network'));
    api.defaults.adapter = adapter; await expect(api.post('/charge')).rejects.toThrow('network');
    expect(adapter).toHaveBeenCalledTimes(1); expect(refresh).not.toHaveBeenCalled();
  });
  it('accepts a valid short-lived access token while rendering the final seconds', async () => {
    store.get.mockImplementation(name => ({ value: name === 'accessToken' ? jwt(10) : 'r' }));
    const api = await getServerApiClient(); api.defaults.adapter = async config => ({ data: {}, status: 200, statusText: '', headers: {}, config });
    await api.get('/private'); expect(refresh).not.toHaveBeenCalled();
  });
});
