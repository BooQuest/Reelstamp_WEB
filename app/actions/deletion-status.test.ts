// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import axios, { AxiosError } from 'axios';
import { prepareDeletionAction, deletionReceiptForUser, getDeletionStatusAction, acknowledgeDeletionAction } from './deletion-status';
const { values, store, api, client } = vi.hoisted(() => {
  const values = new Map<string, string>();
  const api = { post: vi.fn() };
  return { values, api, client: vi.fn(async () => api), store: {
    get: vi.fn((key: string) => values.has(key) ? { value: values.get(key) } : undefined),
    set: vi.fn((key: string, value: string) => { values.set(key, value); }),
    delete: vi.fn((key: string) => { values.delete(key); }),
  } };
});
vi.mock('next/headers', () => ({ cookies: async () => store }));
vi.mock('@/app/lib/api/server-client', () => ({ getMutableServerApiClient: client }));
const receipt = 'a'.repeat(43), cookie = 'account-deletion-receipt';
beforeEach(() => {
  vi.clearAllMocks(); values.clear();
  api.post.mockResolvedValue({ data: { success: true, data: { deletionRequestId: 'request', receipt } } });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
it('persists a server-only receipt before DELETE and returns no receipt to client code', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  expect(await prepareDeletionAction(7)).toBeUndefined();
  expect(client).toHaveBeenCalledWith({ expectedUserId: 7, retryAuthentication: false });
  expect(store.set).toHaveBeenCalledWith(cookie, expect.any(String), expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'strict' }));
  expect(await deletionReceiptForUser(7)).toBe('request');
  await expect(deletionReceiptForUser(8)).rejects.toThrow('Deletion account mismatch');
});
it('does not bypass failed preparation on a current server', async () => {
  api.post.mockRejectedValue(new Error('network timeout'));
  await expect(prepareDeletionAction(7)).rejects.toThrow();
  expect(store.set).not.toHaveBeenCalled();
});
it('supports only explicit old-server absence, not arbitrary HTTP failures', async () => {
  const error = new AxiosError('absent');
  error.response = { status: 404 } as typeof error.response;
  api.post.mockRejectedValue(error);
  await prepareDeletionAction(7);
  expect(values.has(cookie)).toBe(false);
  error.response = { status: 500 } as typeof error.response;
  await expect(prepareDeletionAction(7)).rejects.toThrow();
});
it('looks up after lost DELETE without authentication or clearing a new login', async () => {
  await prepareDeletionAction(7);
  values.set('accessToken', 'new-account-access');
  const progress = { localStatus: 'LOCAL_DELETED', appleStatus: 'ACTION_REQUIRED', contentStatus: 'PENDING', complete: false };
  const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: { success: true, data: progress } });
  expect(await getDeletionStatusAction()).toEqual(progress);
  expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/api\/account-deletions\/status$/), { receipt }, { timeout: 15000 });
  expect(values.get('accessToken')).toBe('new-account-access');
  expect(values.has(cookie)).toBe(true);
});
it('keeps the receipt when acknowledgement fails', async () => {
  await prepareDeletionAction(7);
  const post = vi.spyOn(axios, 'post').mockRejectedValue(new Error('ambiguous response'));
  await expect(acknowledgeDeletionAction()).rejects.toThrow();
  expect(values.has(cookie)).toBe(true);
  post.mockResolvedValue({ data: { success: true } });
  await acknowledgeDeletionAction();
  expect(values.has(cookie)).toBe(false);
});
