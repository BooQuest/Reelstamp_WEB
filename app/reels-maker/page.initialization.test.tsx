import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ReelsMakerPage from './page';
import { deferred, installObjectUrls, jsonResponse, makeCut, makeSession } from './test/fixtures';
import { releaseEditorSession } from './services/editSession';

const navigation = vi.hoisted(() => ({
  params: new URLSearchParams('templateId=template'),
  router: { push: vi.fn(), replace: vi.fn() },
  failHydration: false,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => navigation.router,
  useSearchParams: () => navigation.params,
}));
vi.mock('@/app/components/providers/AuthProvider', () => ({
  useAuth: () => ({ isAuthenticated: true, user: { id: 1, role: 'USER', guest: false, provider: 'GOOGLE' } }),
}));
vi.mock('./hooks/useClipLibrary', async importOriginal => {
  const actual = await importOriginal<typeof import('./hooks/useClipLibrary')>();
  const { useCallback } = await import('react');
  return { default: function useLibrary(options: Parameters<typeof actual.default>[0]) {
    const library = actual.default(options);
    const originalHydrate = library.hydrate;
    const hydrate = useCallback((...args: Parameters<typeof originalHydrate>) => {
      if (navigation.failHydration) {
        navigation.failHydration = false;
        throw new Error('Temporary hydration failure');
      }
      return originalHydrate(...args);
    }, [originalHydrate]);
    return { ...library, hydrate };
  } };
});

let fetcher: ReturnType<typeof vi.fn>;
const saved = () => makeSession({ draftSavingEnabled: true, draftVersion: 0, newEdit: true });
const page = () => <StrictMode><ReelsMakerPage /></StrictMode>;
beforeEach(() => {
  navigation.params = new URLSearchParams('templateId=template');
  navigation.router.replace.mockReset();
  navigation.router.push.mockReset();
  navigation.failHydration = false;
  sessionStorage.clear();
  installObjectUrls();
  fetcher = vi.fn(async (url: string) => {
    if (url.startsWith('/api/templates/')) return jsonResponse({ success: true, data: {
      id: url.split('/').at(-1), title: 'Template', cuts: [makeCut()],
    } });
    return jsonResponse({ success: true, data: saved() });
  });
  vi.stubGlobal('fetch', fetcher);
});
afterEach(() => {
  cleanup();
  releaseEditorSession(10);
  releaseEditorSession(20);
  vi.unstubAllGlobals();
});
const creations = () => fetcher.mock.calls.filter(([url]) => url === '/api/reels-maker/sessions');

it('keeps one request in flight across repeated renders and a delayed assigned URL', async () => {
  const pending = deferred<Response>();
  const original = fetcher.getMockImplementation()!;
  fetcher.mockImplementation((url: string) => url === '/api/reels-maker/sessions' ? pending.promise : original(url));
  const view = render(page());
  await waitFor(() => expect(creations()).toHaveLength(1));
  for (let index = 0; index < 5; index++) view.rerender(page());
  expect(creations()).toHaveLength(1);
  await act(async () => { pending.resolve(jsonResponse({ success: true, data: saved() })); });
  await screen.findByRole('button', { name: '사진·영상 불러오기' });
  for (let index = 0; index < 5; index++) view.rerender(page());
  expect(creations()).toHaveLength(1);
  navigation.params = new URLSearchParams('templateId=template&sessionId=10');
  view.rerender(page());
  expect(creations()).toHaveLength(1);
  expect(fetcher.mock.calls.filter(([url]) => url.endsWith('/edit'))).toHaveLength(0);
});

it('shows a creation failure without automatic retries, then allows an explicit retry', async () => {
  const original = fetcher.getMockImplementation()!;
  let first = true;
  fetcher.mockImplementation((url: string) => {
    if (url === '/api/reels-maker/sessions' && first) {
      first = false;
      return Promise.reject(new TypeError('Network connection lost'));
    }
    return original(url);
  });
  const view = render(page());
  const retry = await screen.findByRole('button', { name: '다시 시도하기' });
  for (let index = 0; index < 3; index++) view.rerender(page());
  expect(creations()).toHaveLength(1);
  fireEvent.click(retry);
  await screen.findByRole('button', { name: '사진·영상 불러오기' });
  expect(creations()).toHaveLength(2);
});

it('reopens the created ID when hydration fails instead of creating another project', async () => {
  navigation.failHydration = true;
  render(page());
  fireEvent.click(await screen.findByRole('button', { name: '다시 시도하기' }));
  await screen.findByRole('button', { name: '사진·영상 불러오기' });
  expect(creations()).toHaveLength(1);
  expect(fetcher.mock.calls.map(([url]) => url)).toContain('/api/reels-maker/sessions/10');
  expect(fetcher.mock.calls.map(([url]) => url)).toContain('/api/reels-maker/sessions/10/edit');
  expect(navigation.router.replace).toHaveBeenLastCalledWith('/reels-maker?templateId=template&sessionId=10');
});

it('ignores an old template response without hiding the next template loading state', async () => {
  const old = deferred<Response>();
  const next = deferred<Response>();
  const original = fetcher.getMockImplementation()!;
  fetcher.mockImplementation((url: string, init?: RequestInit) => {
    if (url === '/api/reels-maker/sessions')
      return JSON.parse(String(init?.body)).templateId === 'template' ? old.promise : next.promise;
    return original(url);
  });
  const view = render(page());
  await waitFor(() => expect(creations()).toHaveLength(1));
  navigation.params = new URLSearchParams('templateId=other');
  view.rerender(page());
  await waitFor(() => expect(creations()).toHaveLength(2));
  await act(async () => { old.resolve(jsonResponse({ success: true, data: saved() })); });
  expect(navigation.router.replace).not.toHaveBeenCalled();
  expect(screen.getByText('릴스 제작 세션을 준비하는 중입니다...')).toBeInTheDocument();
  await act(async () => { next.resolve(jsonResponse({ success: true, data: { ...saved(), sessionId: 20, templateId: 'other' } })); });
  await screen.findByRole('button', { name: '사진·영상 불러오기' });
  expect(navigation.router.replace).toHaveBeenCalledTimes(1);
  expect(navigation.router.replace).toHaveBeenCalledWith('/reels-maker?templateId=other&sessionId=20');
});

it('loads an existing project on mount and reload without creating a new project', async () => {
  navigation.params = new URLSearchParams('templateId=template&sessionId=10');
  const view = render(page());
  await screen.findByRole('button', { name: '사진·영상 불러오기' });
  view.unmount();
  render(page());
  await screen.findByRole('button', { name: '사진·영상 불러오기' });
  expect(creations()).toHaveLength(0);
  expect(fetcher.mock.calls.filter(([url]) => url.endsWith('/10/edit'))).toHaveLength(2);
});


it('preserves the project ID through save, reopen and discard of a later edit', async () => {
  let isSaved = false;
  const original = fetcher.getMockImplementation()!;
  fetcher.mockImplementation((url: string) => {
    if (url.endsWith('/edit/save')) {
      isSaved = true;
      return jsonResponse({ success: true, data: { outcome: 'SAVED' } });
    }
    if (url.endsWith('/edit/discard')) return jsonResponse({ success: true, data: { outcome: 'DISCARDED' } });
    if (url.startsWith('/api/reels-maker/')) return jsonResponse({ success: true, data: { ...saved(), newEdit: !isSaved } });
    return original(url);
  });
  const first = render(page());
  await screen.findByRole('button', { name: '사진·영상 불러오기' });
  const guide = screen.queryByRole('button', { name: '템플릿 가이드 닫기' });
  if (guide) fireEvent.click(guide);
  fireEvent.click(screen.getByRole('button', { name: '뒤로가기' }));
  fireEvent.click(screen.getByRole('button', { name: '저장 후 나가기' }));
  await waitFor(() => expect(navigation.router.push).toHaveBeenCalledTimes(1));
  expect(isSaved).toBe(true);
  first.unmount();
  navigation.params = new URLSearchParams('templateId=template&sessionId=10');
  render(page());
  await screen.findByRole('button', { name: '사진·영상 불러오기' });
  fireEvent.click(screen.getByRole('button', { name: '뒤로가기' }));
  expect(screen.getByText(/편집을 시작하기 전 상태로 복원/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '저장하지 않고 나가기' }));
  await waitFor(() => expect(navigation.router.push).toHaveBeenCalledTimes(2));
  expect(creations()).toHaveLength(1);
  expect(fetcher.mock.calls.map(([url]) => url)).toContain('/api/reels-maker/sessions/10/edit/discard');
});
