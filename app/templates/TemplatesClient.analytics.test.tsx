import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import TemplatesClient from './TemplatesClient';

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/app/components/providers/AuthProvider', () => ({
  useAuth: () => ({ isAuthenticated: true, user: { guest: false }, subscription: null, isLoadingSubscription: false }),
}));
vi.mock('@/app/hooks/useSavedTemplates', () => ({
  useSavedTemplates: () => ({ savedSet: new Set(), toggleSave: vi.fn() }),
}));
vi.mock('@/app/components/ui/TemplateMediaPreview', () => ({ default: () => <div /> }));

let available: boolean;
beforeEach(() => {
  available = true;
  vi.stubGlobal('gtag', vi.fn());
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify({
    success: true,
    data: url === '/api/template-requests'
      ? { requested: true, requestCount: 1 }
      : { cards: [{
          id: 'trend-card', trendReelId: 'trend-reel', templateId: available ? 'template-42' : null,
          title: '테스트 트렌드', subtitle: '', tags: [], accessType: 'FREE',
          status: available ? 'AVAILABLE' : 'REQUESTABLE', requestCount: 0, requestedByMe: false,
        }] },
  }))));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

it('sends the actual template ID and visible name only when the start button is clicked', async () => {
  render(<TemplatesClient />);
  const start = await screen.findByRole('button', { name: '3분 만에 만들기' });
  expect(window.gtag).not.toHaveBeenCalled();
  fireEvent.click(start);
  expect(window.gtag).toHaveBeenCalledExactlyOnceWith('event', 'template_start', {
    template_id: 'template-42', template_name: '테스트 트렌드', send_to: 'G-8YXS25H07Z',
  });
  expect(router.push).toHaveBeenCalledWith('/reels-maker?templateId=template-42&returnUrl=%2Ftemplates');
});

it('does not count requesting an unavailable template as starting it', async () => {
  available = false;
  render(<TemplatesClient />);
  fireEvent.click(await screen.findByRole('button', { name: '템플릿 요청' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '요청 완료' })).toBeDisabled());
  expect(window.gtag).not.toHaveBeenCalled();
});
