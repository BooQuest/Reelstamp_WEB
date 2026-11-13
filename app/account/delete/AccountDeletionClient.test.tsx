import { StrictMode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { UserInfo } from '@/app/lib/api/auth';
import AccountDeletionClient from './AccountDeletionClient';
import { acceptDeletionCallback, clearDeletionFlow, rememberDeletionConfirmation } from '@/app/lib/account-deletion/browser';
const { auth, preview, start, remove, navigate, done } = vi.hoisted(() => ({
  auth: { user: { id: 7, provider: 'KAKAO' } as UserInfo | null, isAuthenticated: true, completeAccountDeletion: vi.fn() },
  preview: vi.fn(), start: vi.fn(), remove: vi.fn(), navigate: vi.fn(), done: vi.fn(),
}));
vi.mock('@/app/components/providers/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('@/app/actions/account-deletion', () => ({ getDeletionPreviewAction: preview, startDeletionReauthenticationAction: start, deleteAccountAction: remove }));
vi.mock('@/app/lib/account-deletion/browser', async importOriginal => ({
  ...await importOriginal<typeof import('@/app/lib/account-deletion/browser')>(),
  navigateToDeletionProvider: navigate, navigateAfterAccountDeletion: done,
}));
const started = { purpose: 'account_deletion' as const, transactionId: 'tx', state: 'state', authorizationUrl: 'https://provider.test' };
const passes = { active: [{ type: 'PURCHASE', productName: '1개월', paidAt: '2026-11-01T00:00:00Z', expiresAt: '2026-12-01T00:00:00Z', amount: 19000 }],
  scheduled: [{ type: 'COUPON', productName: '쿠폰 이용권', paidAt: null, expiresAt: '2027-01-01T00:00:00Z', amount: null }] };
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear(); clearDeletionFlow(); window.history.replaceState({}, '', '/account/delete');
  auth.user = { id: 7, provider: 'KAKAO' } as UserInfo; auth.isAuthenticated = true;
  preview.mockResolvedValue({ success: true, data: passes });
  start.mockResolvedValue({ success: true, data: started });
  remove.mockResolvedValue({ success: true, data: undefined });
});
afterEach(cleanup);
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['private'], { privateData: true });
  const rendered = render(<StrictMode><QueryClientProvider client={client}><AccountDeletionClient /></QueryClientProvider></StrictMode>);
  return { ...rendered, client };
}
async function confirm(button = '카카오 연결 해제 후 탈퇴') {
  await screen.findByText('1개월');
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: button }));
}
it('shows the public deletion/retention scope and a login link returning to this page', () => {
  auth.user = null; auth.isAuthenticated = false; mount();
  expect(screen.getByText('회원정보, 저장한 프로젝트·영상·이미지·자막, 즐겨찾기가 삭제됩니다.')).toBeInTheDocument();
  expect(screen.getByText('결제·환불 등 법령상 보존이 필요한 기록은 안내된 기간 동안 분리 보관됩니다.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '로그인' })).toHaveAttribute('href', '/login?returnUrl=%2Faccount%2Fdelete');
  expect(preview).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled();
});
it('shows exact scope before the pass warning, with active and scheduled values from the API', async () => {
  const { container } = mount();
  await screen.findByText('1개월');
  const text = container.textContent!;
  expect(text.indexOf('회원정보, 저장한')).toBeLessThan(text.indexOf('결제·환불 등'));
  expect(text.indexOf('결제·환불 등')).toBeLessThan(text.indexOf('남은 이용권이 있습니다. 만료일:'));
  expect(screen.getByText('탈퇴 시 남은 이용권은 소멸합니다. 환불을 원하시면 탈퇴 전에 고객센터로 요청해 주세요.')).toBeInTheDocument();
  expect(text).toContain('2027'); expect(text).toContain('₩19,000');
  expect(screen.getByText('시작 예정 이용권')).toBeInTheDocument();
  expect(text).not.toContain('환불 불가');
  expect(screen.getByRole('button', { name: '카카오 연결 해제 후 탈퇴' })).toBeDisabled();
});
it.each([['KAKAO', '카카오 연결 해제 후 탈퇴'], ['GUEST', '탈퇴하기'], ['APPLE', 'Apple 연결 해제 후 탈퇴']] as const)('%s deletes directly after confirmation and clears local state/cache', async (provider, label) => {
  auth.user!.provider = provider;
  const { client } = mount(); await confirm(label);
  await waitFor(() => expect(done).toHaveBeenCalledOnce());
  expect(remove).toHaveBeenCalledExactlyOnceWith(7); expect(start).not.toHaveBeenCalled();
  expect(auth.completeAccountDeletion).toHaveBeenCalledOnce();
  expect(client.getQueryCache().getAll()).toHaveLength(0);
  expect(sessionStorage.length).toBe(0);
});
it.each([['NAVER', '네이버'], ['GOOGLE', '구글']] as const)('%s starts reauthentication only after the final confirmation', async (provider, label) => {
  auth.user!.provider = provider; mount(); await confirm(`${label} 연결 해제 후 탈퇴`);
  await waitFor(() => expect(navigate).toHaveBeenCalledWith(started.authorizationUrl));
  expect(start).toHaveBeenCalledExactlyOnceWith(7); expect(remove).not.toHaveBeenCalled();
});
it('automatically deletes once on reauth return in StrictMode without another click or preview wait', async () => {
  auth.user!.provider = 'GOOGLE'; rememberDeletionConfirmation(7, started);
  acceptDeletionCallback(new URLSearchParams({ state: 'state', code: 'code' }));
  mount();
  await waitFor(() => expect(done).toHaveBeenCalledOnce());
  expect(remove).toHaveBeenCalledExactlyOnceWith(7, { transactionId: 'tx', state: 'state', code: 'code' });
  expect(preview).not.toHaveBeenCalled(); expect(start).not.toHaveBeenCalled();
});
it.each(['RS-ACC-001', 'RS-ACC-002', 'RS-ACC-003'])('shows %s, preserves session and requires a new confirmation', async errorCode => {
  remove.mockResolvedValue({ success: false, errorCode }); mount(); await confirm();
  expect(await screen.findByRole('alert')).toHaveTextContent(errorCode === 'RS-ACC-001' ? '본인 확인에 실패' : errorCode === 'RS-ACC-002' ? '진행 중인 결제' : '일시적인 오류');
  expect(done).not.toHaveBeenCalled(); expect(auth.completeAccountDeletion).not.toHaveBeenCalled();
  expect(screen.getByRole('checkbox')).not.toBeChecked(); expect(remove).toHaveBeenCalledTimes(1);
});
it('blocks deletion when preview cannot be loaded', async () => {
  preview.mockResolvedValue({ success: false, errorCode: 'RS-ACC-003' }); mount();
  await screen.findByRole('alert'); expect(screen.getByRole('button', { name: '카카오 연결 해제 후 탈퇴' })).toBeDisabled();
  expect(remove).not.toHaveBeenCalled();
});
it('does not delete after OAuth cancellation or an account switch', async () => {
  rememberDeletionConfirmation(8, started); acceptDeletionCallback(new URLSearchParams({ state: 'state', code: 'code' }));
  mount(); expect(await screen.findByRole('alert')).toHaveTextContent('본인 확인에 실패');
  expect(remove).not.toHaveBeenCalled();
});
