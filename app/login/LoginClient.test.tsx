import { StrictMode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import LoginClient from './LoginClient';
import { clearDeletionFlow, rememberDeletionConfirmation, resumeDeletion } from '@/app/lib/account-deletion/browser';
const { auth, login, guest, replace } = vi.hoisted(() => ({
  auth: { user: null as { id: number; provider: string } | null, isAuthenticated: false, setUser: vi.fn() },
  login: vi.fn(), guest: vi.fn(), replace: vi.fn(),
}));
vi.mock('@/app/components/providers/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('@/app/actions/auth', () => ({ loginWithSocialAction: login, loginAsGuestAction: guest }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear(); clearDeletionFlow(); window.history.replaceState({}, '', '/login');
  auth.user = null; auth.isAuthenticated = false;
  login.mockResolvedValue({ success: true, userInfo: { id: 1, provider: 'GOOGLE' } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: 'provider-token' }))));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it.each(['naver', 'google', 'kakao'])('keeps the ordinary %s login exchange and return URL', async provider => {
  const state = `${provider}_nonce.%2Faccount%2Fdelete`;
  sessionStorage.setItem('oauth_state', state); sessionStorage.setItem('oauth_provider', provider.toUpperCase());
  window.history.replaceState({}, '', `/login?code=code&state=${encodeURIComponent(state)}`);
  render(<StrictMode><LoginClient /></StrictMode>);
  await waitFor(() => expect(login).toHaveBeenCalledWith('provider-token', provider.toUpperCase()));
  expect(fetch).toHaveBeenCalledExactlyOnceWith(`/api/auth/${provider}-token`, expect.objectContaining({ method: 'POST' }));
  expect(replace).toHaveBeenCalledWith('/account/delete'); expect(login).toHaveBeenCalledOnce();
});
it('rejects ordinary OAuth state mismatch without exchanging a token', async () => {
  sessionStorage.setItem('oauth_state', 'other');
  window.history.replaceState({}, '', '/login?code=code&state=google_nonce');
  render(<LoginClient />);
  await screen.findByText('로그인 state 검증에 실패했습니다. 다시 시도해주세요.');
  expect(fetch).not.toHaveBeenCalled(); expect(login).not.toHaveBeenCalled();
});
it('branches an authenticated deletion callback before login and removes the code from the URL', async () => {
  auth.user = { id: 7, provider: 'GOOGLE' }; auth.isAuthenticated = true;
  rememberDeletionConfirmation(7, { purpose: 'account_deletion', transactionId: 'tx', state: 'deletion-state', authorizationUrl: 'https://provider.test' });
  window.history.replaceState({}, '', '/login?code=deletion-code&state=deletion-state');
  render(<StrictMode><LoginClient accountDeletionCallback /></StrictMode>);
  await waitFor(() => expect(replace).toHaveBeenCalledExactlyOnceWith('/account/delete'));
  expect(window.location.search).toBe('');
  expect(fetch).not.toHaveBeenCalled(); expect(login).not.toHaveBeenCalled(); expect(guest).not.toHaveBeenCalled();
  expect(auth.setUser).not.toHaveBeenCalled();
  const remove = vi.fn(async () => ({ success: true as const, data: undefined }));
  await resumeDeletion(7, remove);
  expect(remove).toHaveBeenCalledWith({ transactionId: 'tx', state: 'deletion-state', code: 'deletion-code' });
});
it('returns deletion cancellation to the result without invoking login', async () => {
  rememberDeletionConfirmation(7, { purpose: 'account_deletion', transactionId: 'tx', state: 'state', authorizationUrl: 'https://provider.test' });
  window.history.replaceState({}, '', '/login?error=access_denied&state=state');
  render(<LoginClient accountDeletionCallback />);
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/account/delete?reauthError=1'));
  expect(fetch).not.toHaveBeenCalled(); expect(login).not.toHaveBeenCalled();
});
it('shows the completion notice on /login and removes its query marker', async () => {
  window.history.replaceState({}, '', '/login?accountDeleted=1');
  render(<LoginClient />);
  expect(await screen.findByRole('status')).toHaveTextContent('탈퇴가 완료되었습니다');
  expect(window.location.pathname).toBe('/login'); expect(window.location.search).toBe('');
  expect(login).not.toHaveBeenCalled();
});
