import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import SessionRecovery from './SessionRecovery';
import type { UserInfo } from '@/app/lib/api/auth';
import { authFetch, blockAuthenticatedRequests } from '@/app/lib/auth/browser-session';
const user = { id: 1, provider: 'GOOGLE' } as UserInfo;
const response = (id: number) => new Response(JSON.stringify({ data: { userInfo: { ...user, id }, refreshTokenExpiresAt: new Date(Date.now()+100000).toISOString() } }));
beforeEach(() => { vi.stubGlobal('BroadcastChannel', undefined); blockAuthenticatedRequests(false); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('retains the original account and blocks edits when another tab switches accounts', async () => {
  const verified=vi.fn(); const expired=vi.fn();
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response(2)));
  render(<SessionRecovery user={user} onVerified={verified} onExpired={expired} />);
  expect(await screen.findByRole('dialog')).toBeTruthy();
  expect(verified).not.toHaveBeenCalled();
  expect((await authFetch('/api/reels-maker/sessions/10/draft',{method:'PUT'})).status).toBe(401);
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('requires server confirmation of the same account before resuming', async () => {
  const verified=vi.fn();
  vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(new Response(null,{status:401})).mockResolvedValueOnce(response(1)));
  render(<SessionRecovery user={user} onVerified={verified} onExpired={vi.fn()} />);
  await screen.findByRole('dialog');
  fireEvent.click(screen.getByRole('button',{name:'로그인 완료 확인'}));
  await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
  expect(verified).toHaveBeenCalledWith(expect.objectContaining({id:1}));
});
it('shows connection failure without expiring the account', async () => {
  const expired=vi.fn();vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));
  render(<SessionRecovery user={user} onVerified={vi.fn()} onExpired={expired} />);
  await screen.findByRole('status');expect(expired).not.toHaveBeenCalled();expect(screen.queryByRole('dialog')).toBeNull();
});
it('uses the common expiry dialog for guests without promising recovery or adding a migration notice', async () => {
  const guest = { ...user, provider: 'GUEST', guest: true } as UserInfo;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
  render(<SessionRecovery user={guest} onVerified={vi.fn()} onExpired={vi.fn()} />);
  expect(await screen.findByRole('dialog')).toBeTruthy();
  expect(screen.getByText('로그인이 만료되었거나 종료됐어요.')).toBeTruthy();
  expect(screen.queryByText(/작업을 이어갈 수 있어요/)).toBeNull();
  expect(screen.queryByText(/재접근|현재 게스트 이용은|새로 시작/)).toBeNull();
});
it('does not display a transition deadline for an authenticated guest', async () => {
  const guest = { ...user, provider: 'GUEST', guest: true } as UserInfo;
  const verified = vi.fn();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {
    userInfo: guest, refreshTokenExpiresAt: new Date(Date.now() + 100000).toISOString(),
  } }))));
  const { container } = render(<SessionRecovery user={guest} onVerified={verified} onExpired={vi.fn()} />);
  await waitFor(() => expect(verified).toHaveBeenCalledWith(guest));
  expect(container.textContent).toBe('');
});
