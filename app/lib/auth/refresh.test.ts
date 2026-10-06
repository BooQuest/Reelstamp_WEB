// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import axios, { AxiosError } from 'axios';
import { refreshTokens, requireTokenInfo } from './refresh';
import { saveTokenCookies } from './token-cookies';
vi.mock('axios', async original => {
  const actual = await original<typeof import('axios')>();
  return { ...actual, default: { ...actual.default, post: vi.fn() } };
});
const info = () => ({ accessToken: 'a', refreshToken: 'r', sessionId: 'sid', tokenType: 'Bearer', expiresIn: 3600,
  accessTokenExpiresAt: new Date(Date.now() + 3600000).toISOString(), refreshTokenExpiresAt: new Date(Date.now() + 86400000).toISOString() });
const failure = (status?: number) => new AxiosError('test', undefined, undefined, undefined,
  status ? { status, data: {}, statusText: '', headers: {}, config: {} } as never : undefined);
afterEach(() => vi.resetAllMocks());
describe('refresh exchange', () => {
  it.each([undefined, 500, 503])('retries only one exchange after %s and returns server expiry', async status => {
    const token = info();
    vi.mocked(axios.post).mockRejectedValueOnce(failure(status)).mockResolvedValueOnce({ data: { success: true, data: token } });
    expect(await refreshTokens('r')).toEqual(token);
    expect(axios.post).toHaveBeenCalledTimes(2);
  });
  it.each([401, 429, 500])('classifies %s without leaking credentials', async status => {
    vi.mocked(axios.post).mockRejectedValue(failure(status));
    await expect(refreshTokens('secret')).rejects.toMatchObject({ response: { status: status === 401 ? 401 : 503 } });
    expect(axios.post).toHaveBeenCalledTimes(status === 500 ? 2 : 1);
  });
  it('rejects incompatible expiry metadata rather than inventing cookie lifetimes', () => {
    expect(() => requireTokenInfo({ ...info(), refreshTokenExpiresAt: 'bad' })).toThrow();
    const token = info(); const set = vi.fn(); saveTokenCookies({ set, delete: vi.fn() }, token);
    expect(set).toHaveBeenCalledWith('refreshToken', 'r', expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/', expires: new Date(token.refreshTokenExpiresAt) }));
    expect(set.mock.calls[1][2]).not.toHaveProperty('domain');
    expect(set.mock.calls[1][2]).not.toHaveProperty('maxAge');
  });
});
