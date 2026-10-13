import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useTemplateCreation } from './useTemplateCreation';
import type { TemplateSummary } from './useSavedTemplates';
import type { TemplateAccessSubscription } from '@/app/lib/templates/access';

const state = vi.hoisted(() => ({
  push: vi.fn(), beta: false,
  auth: { isAuthenticated: true, user: { role: 'USER', guest: false }, subscription: { passActive: true } as TemplateAccessSubscription, isLoadingSubscription: false },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: state.push }) }));
vi.mock('@/app/components/providers/AuthProvider', () => ({ useAuth: () => state.auth }));
vi.mock('@/app/lib/constants/beta', () => ({ isReelstampBetaEnabled: () => state.beta }));
const paid: TemplateSummary = { id: 'a/b', title: 'Paid', subtitle: '', tags: [], accessType: 'PAID' };
const destination = '/reels-maker?templateId=a%2Fb&returnUrl=%2Fsaved-reels';

beforeEach(() => {
  vi.useFakeTimers();
  state.beta = false;
  state.auth = { isAuthenticated: true, user: { role: 'USER', guest: false }, subscription: { passActive: true }, isLoadingSubscription: false };
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });

it.each([
  { authenticated: false, guest: false, accessType: 'FREE' as const, path: `/login?returnUrl=${encodeURIComponent(destination)}` },
  { authenticated: false, guest: false, accessType: 'PAID' as const, path: '/login?returnUrl=%2Fpricing' },
  { authenticated: true, guest: true, accessType: 'FREE' as const, path: destination },
  { authenticated: true, guest: true, accessType: 'PAID' as const, path: '/login?returnUrl=%2Fpricing' },
  { authenticated: true, guest: false, accessType: 'PAID' as const, path: destination },
])('preserves authentication policy for $authenticated / guest=$guest / $accessType', ({ authenticated, guest, accessType, path }) => {
  state.auth.isAuthenticated = authenticated;
  state.auth.user.guest = guest;
  const { result } = renderHook(() => useTemplateCreation('/saved-reels'));
  expect(state.push).not.toHaveBeenCalled();
  act(() => result.current.create({ ...paid, accessType }));
  act(() => vi.advanceTimersByTime(800));
  expect(state.push).toHaveBeenCalledExactlyOnceWith(path);
});

it('does not proceed while checking a paid pass, or when a template is coming soon', () => {
  state.auth.isLoadingSubscription = true;
  const { result } = renderHook(() => useTemplateCreation('/saved-reels'));
  expect(result.current.isAccessLoading(paid)).toBe(true);
  act(() => result.current.create(paid));
  act(() => result.current.create({ ...paid, status: 'COMING_SOON' }));
  act(() => vi.runAllTimers());
  expect(state.push).not.toHaveBeenCalled();
});

it('cancels a pending login redirect when the preview closes', () => {
  state.auth.isAuthenticated = false;
  const { result, unmount } = renderHook(() => useTemplateCreation('/saved-reels'));
  act(() => result.current.create(paid));
  expect(result.current.accessMessage).toBe('로그인 시 이용 가능한 기능입니다.');
  unmount();
  act(() => vi.runAllTimers());
  expect(state.push).not.toHaveBeenCalled();
});

it('preserves beta guest access when that existing policy is enabled', () => {
  state.beta = true;
  state.auth.user.guest = true;
  state.auth.subscription = { passActive: false };
  const { result } = renderHook(() => useTemplateCreation('/saved-reels'));
  act(() => result.current.create(paid));
  expect(state.push).toHaveBeenCalledExactlyOnceWith(destination);
});

it.each([
  { role: 'ADMIN', loading: true, subscription: null },
  { role: 'admin', loading: false, subscription: null },
  { role: 'ADMIN', loading: false, subscription: { passActive: false } },
])('lets $role create a paid template without a pass while loading=$loading', ({ role, loading, subscription }) => {
  state.auth.user.role = role;
  state.auth.subscription = subscription;
  state.auth.isLoadingSubscription = loading;
  const { result } = renderHook(() => useTemplateCreation('/saved-reels'));
  expect(result.current.isAccessLoading(paid)).toBe(false);
  act(() => result.current.create(paid));
  expect(state.push).toHaveBeenCalledExactlyOnceWith(destination);
});

it('still blocks coming-soon templates for admins', () => {
  state.auth.user.role = 'ADMIN';
  const { result } = renderHook(() => useTemplateCreation('/saved-reels'));
  act(() => result.current.create({ ...paid, status: 'COMING_SOON' }));
  expect(state.push).not.toHaveBeenCalled();
  expect(result.current.accessMessage).toBe('아직 추가 예정인 템플릿입니다.');
});

it('still redirects regular users without a pass to pricing', () => {
  state.auth.subscription = { passActive: false };
  const { result } = renderHook(() => useTemplateCreation('/saved-reels'));
  act(() => result.current.create(paid));
  expect(state.push).toHaveBeenCalledExactlyOnceWith('/pricing');
});
