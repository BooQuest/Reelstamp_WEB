// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { deleteAccountAction, getDeletionPreviewAction, startDeletionReauthenticationAction } from './account-deletion';
import { DELETION_COOKIE } from '@/app/lib/account-deletion/server';

const { values, store, api, client, requestHeaders } = vi.hoisted(() => {
  const values = new Map<string, string>();
  const api = { get: vi.fn(), post: vi.fn(), delete: vi.fn() };
  return { values, api, client: vi.fn(async () => api), requestHeaders: new Map<string, string>(),
    store: { get: vi.fn((key: string) => values.has(key) ? { value: values.get(key) } : undefined),
      set: vi.fn((key: string, value: string) => { values.set(key, value); }),
      delete: vi.fn((key: string) => { values.delete(key); }) } };
});
vi.mock('next/headers', () => ({ cookies: async () => store, headers: async () => new Headers(Object.fromEntries(requestHeaders)) }));
vi.mock('@/app/lib/api/server-client', () => ({ getMutableServerApiClient: client }));
const started = { purpose: 'account_deletion', transactionId: 'tx-1', state: 'opaque-state', authorizationUrl: 'https://accounts.google.com/authorize' };
const proof = { transactionId: started.transactionId, state: started.state, code: 'one-use-code' };
beforeEach(() => {
  vi.clearAllMocks(); values.clear(); requestHeaders.clear();
  requestHeaders.set('origin', 'https://web.test');
  values.set('accessToken', 'access'); values.set('refreshToken', 'refresh');
  api.post.mockResolvedValue({ data: { success: true, data: started } });
  api.delete.mockResolvedValue({ data: { success: true, data: { userDeleted: true, socialUnlinked: false } } });
});

it('sends server PKCE and keeps its verifier in an HttpOnly cookie, separate from login', async () => {
  const result = await startDeletionReauthenticationAction(7);
  expect(result).toEqual({ success: true, data: started });
  const context = JSON.parse(values.get(DELETION_COOKIE)!);
  expect(api.post).toHaveBeenCalledWith('/api/user/me/deletion-reauth', {
    purpose: 'account_deletion', platform: 'web', redirectUri: 'https://web.test/login',
    codeChallenge: createHash('sha256').update(context.codeVerifier).digest('base64url'),
  });
  expect(store.set).toHaveBeenCalledWith(DELETION_COOKIE, expect.any(String), expect.objectContaining({ httpOnly: true, sameSite: 'lax', maxAge: 600 }));
  expect(client).toHaveBeenCalledWith({ expectedUserId: 7, retryAuthentication: false });
  expect(JSON.stringify(result)).not.toContain(context.codeVerifier);
});
it('forwards code only to the Backend and clears auth cookies even if unlink was best-effort', async () => {
  await startDeletionReauthenticationAction(7);
  const context = JSON.parse(values.get(DELETION_COOKIE)!);
  expect(await deleteAccountAction(7, proof)).toEqual({ success: true, data: undefined });
  expect(api.delete).toHaveBeenCalledExactlyOnceWith('/api/user/me', {
    data: { ...proof, codeVerifier: context.codeVerifier }, timeout: 60_000,
  });
  expect(values.has('accessToken')).toBe(false); expect(values.has('refreshToken')).toBe(false);
  expect(values.has(DELETION_COOKIE)).toBe(false);
  expect(api.post).toHaveBeenCalledTimes(1); // no logout or provider token exchange route
});
it('deletes Kakao, Guest or Apple without a reauthentication body', async () => {
  await deleteAccountAction(7);
  expect(api.delete).toHaveBeenCalledWith('/api/user/me', { data: undefined, timeout: 60_000 });
  expect(api.post).not.toHaveBeenCalled();
});
it.each(['user', 'state', 'transaction', 'expiry', 'code', 'missing'] as const)('rejects invalid %s before DELETE and preserves credentials', async invalid => {
  await startDeletionReauthenticationAction(7);
  const context = JSON.parse(values.get(DELETION_COOKIE)!);
  if (invalid === 'expiry') values.set(DELETION_COOKIE, JSON.stringify({ ...context, expiresAt: 0 }));
  if (invalid === 'missing') values.delete(DELETION_COOKIE);
  const supplied = { ...proof, ...(invalid === 'state' ? { state: 'other' } : {}),
    ...(invalid === 'transaction' ? { transactionId: 'other' } : {}), ...(invalid === 'code' ? { code: '' } : {}) };
  expect(await deleteAccountAction(invalid === 'user' ? 8 : 7, supplied)).toEqual({ success: false, errorCode: 'RS-ACC-001' });
  expect(api.delete).not.toHaveBeenCalled(); expect(values.has('accessToken')).toBe(true);
});
it.each(['RS-ACC-001', 'RS-ACC-002', 'RS-ACC-003', 'AUTH_ACCOUNT_CHANGED'])('returns a safe error for %s without clearing cookies or retrying', async code => {
  api.delete.mockRejectedValue({ response: { status: 409, data: { errorCode: code, message: 'private upstream response' } } });
  const result = await deleteAccountAction(7);
  expect(result).toEqual({ success: false, errorCode: code === 'AUTH_ACCOUNT_CHANGED' ? 'RS-ACC-001' : code });
  expect(api.delete).toHaveBeenCalledTimes(1); expect(store.delete).not.toHaveBeenCalled();
});
it('keeps credentials on ambiguous timeout and does not claim success', async () => {
  api.delete.mockRejectedValue(new Error('sensitive network detail'));
  expect(await deleteAccountAction(7)).toEqual({ success: false, errorCode: 'RS-ACC-003' });
  expect(store.delete).not.toHaveBeenCalled(); expect(api.delete).toHaveBeenCalledTimes(1);
});
it('does not treat a 200 response without userDeleted as completion', async () => {
  api.delete.mockResolvedValue({ data: { success: true, data: {} } });
  expect(await deleteAccountAction(7)).toEqual({ success: false, errorCode: 'RS-ACC-003' });
  expect(store.delete).not.toHaveBeenCalled();
});
it('returns no-store preview values unchanged, including nullable coupon fields', async () => {
  const preview = { active: [], scheduled: [{ type: 'COUPON', productName: '쿠폰', paidAt: null, amount: null, expiresAt: '2027-01-01T00:00:00Z' }] };
  api.get.mockResolvedValue({ data: { success: true, data: preview } });
  expect(await getDeletionPreviewAction(7)).toEqual({ success: true, data: preview });
  expect(api.get).toHaveBeenCalledWith('/api/user/me/deletion-preview', { headers: { 'Cache-Control': 'no-store' } });
});
it('does not persist a pending flow when Backend provider configuration is missing', async () => {
  api.post.mockRejectedValue({ response: { status: 502, data: { errorCode: 'RS-ACC-003' } } });
  expect(await startDeletionReauthenticationAction(7)).toEqual({ success: false, errorCode: 'RS-ACC-003' });
  expect(store.set).not.toHaveBeenCalled(); expect(store.delete).not.toHaveBeenCalled();
});
