import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OnboardingPopups from './OnboardingPopups';
import SequentialServiceNoticePopups from '../ui/SequentialServiceNoticePopups';

const mock = vi.hoisted(() => ({ path: '/templates' }));
vi.mock('next/navigation', () => ({ usePathname: () => mock.path }));
// Guidance must work independently of login, logout and account switching.
vi.mock('../providers/AuthProvider', () => ({ useAuth: () => { throw new Error('Onboarding must not depend on authentication'); } }));
vi.mock('next/image', () => ({ default: (props: Record<string, unknown>) => {
  const rest = { ...props }; delete rest.priority;
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  return <img {...rest} />;
} }));

const ENTRANCE_KEY = 'reelstamp:onboarding:v1:entrance';
const MAKER_KEY = 'reelstamp:onboarding:v1:reels-making';
const confirm = () => fireEvent.click(screen.getByRole('button', { name: '확인' }));
const expectSlide = async (title: string) => expect(await screen.findByRole('img', { name: title })).toBeVisible();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-10T00:00:00Z'));
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('No onboarding API should be called')));
  mock.path = '/templates';
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('browser-based onboarding', () => {
  it('shows two entrance images followed by three maker images and persists each completed guide', async () => {
    mock.path = '/reels-maker';
    const view = render(<OnboardingPopups />);
    await expectSlide('오늘의 릴스 트렌드');
    expect(screen.getByLabelText('총 2장 중 1번째 안내').children).toHaveLength(2);
    confirm();
    await expectSlide('다양한 바이럴 템플릿');
    expect(screen.queryByRole('img', { name: '오늘의 릴스 트렌드' })).toBeNull();
    expect(localStorage.getItem(ENTRANCE_KEY)).toBeNull();
    confirm();
    expect(localStorage.getItem(ENTRANCE_KEY)).toBe('true');
    await expectSlide('컷별 템플릿 가이드');
    fireEvent.click(screen.getByRole('button', { name: '다음 안내' }));
    await expectSlide('컷 구간 설정');
    fireEvent.keyDown(screen.getByRole('button', { name: '확인' }), { key: 'Escape' });
    await expectSlide('릴스 업로드 완료');
    expect(localStorage.getItem(MAKER_KEY)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '안내 확인 후 닫기' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(localStorage.getItem(MAKER_KEY)).toBe('true');
    view.unmount();
    render(<OnboardingPopups />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('only starts maker guidance on its route and restarts incomplete guidance after leaving', async () => {
    localStorage.setItem(ENTRANCE_KEY, 'true');
    const view = render(<OnboardingPopups />);
    expect(screen.queryByRole('dialog')).toBeNull();
    mock.path = '/reels-maker'; view.rerender(<OnboardingPopups />);
    await expectSlide('컷별 템플릿 가이드'); confirm();
    await expectSlide('컷 구간 설정');
    mock.path = '/templates'; view.rerender(<OnboardingPopups />);
    expect(screen.queryByRole('dialog')).toBeNull();
    mock.path = '/reels-maker'; view.rerender(<OnboardingPopups />);
    await expectSlide('컷별 템플릿 가이드');
    expect(localStorage.getItem(MAKER_KEY)).toBeNull();
  });

  it('restarts incomplete entrance guidance after a remount and ignores background clicks', async () => {
    const view = render(<OnboardingPopups />);
    await expectSlide('오늘의 릴스 트렌드'); confirm();
    fireEvent.click(screen.getByRole('dialog'));
    await expectSlide('다양한 바이럴 템플릿');
    view.unmount(); render(<OnboardingPopups />);
    await expectSlide('오늘의 릴스 트렌드');
  });

  it('uses the browser record on login and other routes without reading account state', async () => {
    const view = render(<OnboardingPopups />);
    await expectSlide('오늘의 릴스 트렌드'); confirm(); confirm();
    expect(screen.queryByRole('dialog')).toBeNull();
    mock.path = '/login'; view.rerender(<OnboardingPopups />);
    expect(screen.queryByRole('dialog')).toBeNull();
    mock.path = '/templates'; view.rerender(<OnboardingPopups />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('syncs completion from another tab and shows guidance again after site data is cleared', async () => {
    render(<OnboardingPopups />);
    await expectSlide('오늘의 릴스 트렌드');
    act(() => {
      localStorage.setItem(ENTRANCE_KEY, 'true');
      window.dispatchEvent(new StorageEvent('storage', { key: ENTRANCE_KEY, newValue: 'true' }));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => {
      localStorage.clear();
      window.dispatchEvent(new StorageEvent('storage', { key: null }));
    });
    await expectSlide('오늘의 릴스 트렌드');
  });

  it('restores scrolling and focus when the guide is closed', async () => {
    const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
    document.body.style.overflow = 'auto';
    render(<OnboardingPopups />);
    await expectSlide('오늘의 릴스 트렌드');
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(screen.getByRole('button', { name: '확인' }), { key: 'Tab' });
    expect(screen.getByRole('button', { name: '다음 안내' })).toHaveFocus();
    confirm(); confirm();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body.style.overflow).toBe('auto');
    expect(trigger).toHaveFocus(); trigger.remove(); document.body.style.overflow = '';
  });

  it('finishes legacy notices before onboarding during the active notice period', async () => {
    vi.setSystemTime(new Date('2026-10-09T14:59:00Z'));
    render(<OnboardingPopups />);
    expect(await screen.findByText('정식 출시 일정 변경 안내 (10/10 출시 예정)')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: '오늘의 릴스 트렌드' })).toBeNull();
    confirm();
    expect(await screen.findByText('일부 기능 안정화 작업 안내')).toBeInTheDocument();
    confirm(); await expectSlide('오늘의 릴스 트렌드');
  });

  it('hides legacy notices exactly at the configured expiration', () => {
    const changed = vi.fn();
    const view = render(<SequentialServiceNoticePopups referenceDate={new Date('2026-10-09T14:59:59Z')} onVisibilityChange={changed} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    view.rerender(<SequentialServiceNoticePopups referenceDate={new Date('2026-10-09T15:00:00Z')} onVisibilityChange={changed} />);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(changed).toHaveBeenLastCalledWith(false);
  });

  it.each(['false', 'invalid'])('does not treat a stored %s value as completed', async value => {
    localStorage.setItem(ENTRANCE_KEY, value);
    render(<OnboardingPopups />);
    await expectSlide('오늘의 릴스 트렌드');
  });

  it('still closes and remembers both guides in memory when storage is unavailable', async () => {
    mock.path = '/reels-maker';
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const view = render(<OnboardingPopups />);
    await expectSlide('오늘의 릴스 트렌드'); confirm(); confirm();
    await expectSlide('컷별 템플릿 가이드'); confirm(); confirm(); confirm();
    expect(screen.queryByRole('dialog')).toBeNull();
    view.unmount(); render(<OnboardingPopups />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
