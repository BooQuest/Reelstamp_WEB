import { beforeEach, expect, it, vi } from 'vitest';
import { acceptDeletionCallback, clearDeletedAccountBrowserState, clearDeletionFlow, rememberDeletionConfirmation, resumeDeletion } from './browser';
const started = { purpose: 'account_deletion' as const, transactionId: 'tx', state: 'state', authorizationUrl: 'https://provider.test' };
const callback = () => new URLSearchParams({ state: 'state', code: 'code' });
beforeEach(() => { sessionStorage.clear(); clearDeletionFlow(); vi.restoreAllMocks(); });
it('requires a saved final confirmation and matching state before accepting a code', () => {
  expect(acceptDeletionCallback(callback())).toBe(false);
  rememberDeletionConfirmation(1, started);
  expect(acceptDeletionCallback(new URLSearchParams({ state: 'wrong', code: 'code' }))).toBe(false);
});
it('rejects ambiguous duplicate callback parameters', () => {
  rememberDeletionConfirmation(1, started);
  const params = callback(); params.append('state', 'other');
  expect(acceptDeletionCallback(params)).toBe(false);
});
it('executes once across callbacks and remounts and removes the code before dispatch', async () => {
  rememberDeletionConfirmation(1, started);
  expect(acceptDeletionCallback(callback())).toBe(true);
  const execute = vi.fn(async () => ({ success: true as const, data: undefined }));
  const first = resumeDeletion(1, execute);
  expect(acceptDeletionCallback(callback())).toBe(true);
  const second = resumeDeletion(1, execute);
  expect(first).toBe(second);
  expect(sessionStorage.getItem('reelstamp:account-deletion')).not.toContain('"code":');
  await first;
  expect(execute).toHaveBeenCalledExactlyOnceWith({ transactionId: 'tx', state: 'state', code: 'code' });
});
it('does not replay after a full reload with a submitted marker and no in-memory promise', async () => {
  rememberDeletionConfirmation(1, started); acceptDeletionCallback(callback());
  const execute = vi.fn(async () => ({ success: false as const, errorCode: 'RS-ACC-003' as const }));
  const pending = resumeDeletion(1, execute);
  const claimed = sessionStorage.getItem('reelstamp:account-deletion')!;
  await pending; clearDeletionFlow(); sessionStorage.setItem('reelstamp:account-deletion', claimed);
  expect(await resumeDeletion(1, execute)).toEqual({ success: false, errorCode: 'RS-ACC-003' });
  expect(execute).toHaveBeenCalledTimes(1);
});
it.each(['cancel', 'expired', 'account-changed'])('does not DELETE after %s', async scenario => {
  rememberDeletionConfirmation(1, started);
  if (scenario === 'cancel') acceptDeletionCallback(new URLSearchParams({ state: 'state', error: 'access_denied' }));
  else acceptDeletionCallback(callback());
  if (scenario === 'expired') vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 700_000);
  const execute = vi.fn();
  expect(await resumeDeletion(scenario === 'account-changed' ? 2 : 1, execute)).toEqual({ success: false, errorCode: 'RS-ACC-001' });
  expect(execute).not.toHaveBeenCalled();
});
it('turns an ambiguous network failure into a result without automatic retry', async () => {
  rememberDeletionConfirmation(1, started); acceptDeletionCallback(callback());
  const execute = vi.fn().mockRejectedValue(new Error('offline'));
  expect(await resumeDeletion(1, execute)).toEqual({ success: false, errorCode: 'RS-ACC-003' });
  await resumeDeletion(1, execute);
  expect(execute).toHaveBeenCalledTimes(1);
});
it('clears OAuth, checkout and editor session cache on success', () => {
  rememberDeletionConfirmation(1, started);
  sessionStorage.setItem('oauth_state', 'old'); sessionStorage.setItem('reelstamp:edit:1', 'edit');
  clearDeletedAccountBrowserState(); expect(sessionStorage.length).toBe(0);
});
