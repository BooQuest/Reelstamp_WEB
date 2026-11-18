import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthProvider';
import type { UserInfo } from '@/app/lib/api/auth';
const { logout, subscription } = vi.hoisted(() => ({ logout: vi.fn(), subscription: vi.fn() }));
vi.mock('@/app/actions/auth', () => ({ logoutAction: logout, getSubscriptionStatusAction: subscription }));
vi.mock('./SessionRecovery', () => ({ default: () => null }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function Consumer() {
  const auth = useAuth();
  return <><output>{auth.user ? 'signed-in' : 'signed-out'}:{auth.subscription ? 'subscription' : 'none'}</output>
    <button onClick={auth.completeAccountDeletion}>complete deletion</button></>;
}
it('clears local identity and ignores a late subscription result without calling logout', async () => {
  vi.stubGlobal('BroadcastChannel', undefined);
  let resolve!: (result: unknown) => void;
  subscription.mockReturnValue(new Promise(res => { resolve = res; }));
  render(<AuthProvider initialUser={{ id: 7, provider: 'GOOGLE' } as UserInfo}><Consumer /></AuthProvider>);
  await waitFor(() => expect(subscription).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button'));
  expect(screen.getByRole('status')).toHaveTextContent('signed-out:none');
  await act(async () => resolve({ success: true, data: { subscription: { active: true } } }));
  expect(screen.getByRole('status')).toHaveTextContent('signed-out:none');
  expect(logout).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});
