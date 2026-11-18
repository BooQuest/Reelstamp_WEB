import { beforeEach, expect, it, vi } from 'vitest';
import LoginPage from './page';
import { DELETION_COOKIE } from '@/app/lib/account-deletion/server';
const { currentUser, redirect, cookieValues } = vi.hoisted(() => ({ currentUser: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }), cookieValues: new Map<string, string>() }));
vi.mock('@/app/lib/api/auth', () => ({ getCurrentUser: currentUser }));
vi.mock('next/navigation', () => ({ redirect }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (key: string) => cookieValues.has(key) ? { value: cookieValues.get(key) } : undefined }) }));
vi.mock('./LoginClient', () => ({ default: () => null }));
beforeEach(() => { vi.clearAllMocks(); cookieValues.clear(); currentUser.mockResolvedValue({ id: 1, provider: 'GOOGLE', guest: false }); });
function pendingDeletion() {
  cookieValues.set(DELETION_COOKIE, JSON.stringify({ purpose: 'account_deletion', userId: 1,
    transactionId: 'tx', state: 'deletion-state', codeVerifier: 'verifier', expiresAt: Date.now() + 600000 }));
}
it('handles a deletion callback before the authenticated-user redirect', async () => {
  pendingDeletion();
  const page = await LoginPage({ searchParams: Promise.resolve({ code: 'code', state: 'deletion-state' }) });
  expect(page.props.accountDeletionCallback).toBe(true); expect(currentUser).not.toHaveBeenCalled();
});
it('also routes provider cancellation and invalid deletion state to the deletion result', async () => {
  pendingDeletion();
  const page = await LoginPage({ searchParams: Promise.resolve({ error: 'access_denied', state: 'wrong' }) });
  expect(page.props.accountDeletionCallback).toBe(true);
});
it('routes an opaque callback to verification failure even after its deletion cookie expires', async () => {
  const page = await LoginPage({ searchParams: Promise.resolve({ code: 'code', state: 'expired-deletion-state' }) });
  expect(page.props.accountDeletionCallback).toBe(true);
  expect(redirect).not.toHaveBeenCalled();
});
it('preserves the normal signed-in return URL redirect', async () => {
  await expect(LoginPage({ searchParams: Promise.resolve({ returnUrl: '/account/delete' }) })).rejects.toThrow('redirect:/account/delete');
});
it('does not hijack ordinary login callbacks while another deletion flow is pending', async () => {
  pendingDeletion(); currentUser.mockResolvedValue(null);
  const page = await LoginPage({ searchParams: Promise.resolve({ code: 'code', state: 'google_nonce.%2Ftemplates' }) });
  expect(page.props.accountDeletionCallback).toBeUndefined(); expect(currentUser).toHaveBeenCalledOnce();
});
it('continues to show ordinary login for guests and unauthenticated users', async () => {
  for (const user of [null, { id: 1, provider: 'GUEST', guest: true }]) {
    currentUser.mockResolvedValue(user);
    const page = await LoginPage({}); expect(page.props.accountDeletionCallback).toBeUndefined();
  }
  expect(redirect).not.toHaveBeenCalled();
});
