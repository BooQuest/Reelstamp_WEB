import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AllTemplatesClient from '@/app/all-templates/AllTemplatesClient';
import SavedReelsClient from '@/app/saved-reels/SavedReelsClient';
import type { TemplateSummary } from '@/app/hooks/useSavedTemplates';

const state = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn() },
  params: new URLSearchParams(),
  entranceCompleted: true,
  auth: { isAuthenticated: true, user: { guest: false }, subscription: { passActive: true }, isLoadingSubscription: false },
}));
vi.mock('next/navigation', () => ({ useRouter: () => state.router, useSearchParams: () => state.params }));
vi.mock('@/app/components/providers/AuthProvider', () => ({ useAuth: () => state.auth }));
vi.mock('@/app/components/onboarding/useOnboarding', () => ({ default: () => ({ status: { entranceCompleted: state.entranceCompleted } }) }));
vi.mock('@/app/lib/constants/beta', () => ({ isReelstampBetaEnabled: () => false }));
vi.mock('@/app/components/ui/TemplateMediaPreview', () => ({
  default: ({ title, embedUrl, preferEmbed }: { title: string; embedUrl?: string; preferEmbed?: boolean }) =>
    <div data-testid="media" data-embed={preferEmbed && embedUrl ? embedUrl : undefined}>{title} 미디어</div>,
}));

const template = (id: string, overrides: Partial<TemplateSummary> = {}): TemplateSummary => ({
  id, title: `템플릿 ${id}`, subtitle: `${id} 설명`, tags: ['트렌드'], embedUrl: `https://www.instagram.com/reel/${id}/`,
  accessType: 'PAID', status: 'AVAILABLE', ...overrides,
});
const a = template('a');
const b = template('b');
const c = template('c');
const coming = template('coming', { status: 'COMING_SOON' });
const categories = [
  { id: 'first', title: '첫 카테고리', displayOrder: 0, templates: [a, coming, b] },
  { id: 'second', title: '두 번째 카테고리', displayOrder: 1, templates: [b, c] },
];
let saved: TemplateSummary[];
let saveFailure: boolean;
const response = (data: unknown) => new Response(JSON.stringify({ success: true, data }));
const fetchMock = vi.fn();

beforeEach(() => {
  state.params = new URLSearchParams();
  state.entranceCompleted = true;
  state.auth = { isAuthenticated: true, user: { guest: false }, subscription: { passActive: true }, isLoadingSubscription: false };
  saved = [c, a];
  saveFailure = false;
  fetchMock.mockImplementation(async (url: string) => {
    if (url === '/api/templates/categories') return response({ categories });
    if (url === '/api/templates/saved') return response({ templates: saved });
    const match = url.match(/^\/api\/templates\/(.+)\/save$/);
    if (match) {
      if (saveFailure) return new Response(JSON.stringify({ success: false, message: '저장 실패: 다시 시도해주세요.' }), { status: 500 });
      const wasSaved = saved.some(item => item.id === match[1]);
      saved = wasSaved ? saved.filter(item => item.id !== match[1]) : [...saved, template(match[1])];
      return response({ templateId: match[1], saved: !wasSaved });
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  // jsdom does not implement native dialog methods or PointerEvent yet.
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) { this.open = true; });
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) { this.open = false; });
});

// Define absent methods before spyOn; native focus trapping is checked in the browser.
if (!HTMLDialogElement.prototype.showModal) HTMLDialogElement.prototype.showModal = () => {};
if (!HTMLDialogElement.prototype.close) HTMLDialogElement.prototype.close = () => {};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const dialog = () => screen.getByRole('dialog', { name: /템플릿/ });
const next = () => fireEvent.click(within(dialog()).getByRole('button', { name: '다음 템플릿' }));
const create = () => fireEvent.click(within(dialog()).getByRole('button', { name: '3분 만에 만들러 가기' }));

describe('template list preview flow', () => {
  it('opens the clicked category without routing or creating a session; only the CTA opens the current template', async () => {
    render(<AllTemplatesClient />);
    fireEvent.click(await screen.findByRole('button', { name: '템플릿 a 상세 보기' }));
    expect(dialog()).toHaveAccessibleName('템플릿 a');
    expect(within(dialog()).getByRole('button', { name: '이전 템플릿' })).toBeDisabled();
    expect(state.router.push).not.toHaveBeenCalled();
    next();
    expect(dialog()).toHaveAccessibleName('템플릿 b');
    expect(within(dialog()).getByRole('button', { name: '다음 템플릿' })).toBeDisabled();
    expect(within(dialog()).queryByText('템플릿 c 미디어')).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.every(([, options]) => options?.method !== 'POST')).toBe(true);
    create();
    expect(state.router.push).toHaveBeenCalledWith('/reels-maker?templateId=b&returnUrl=%2Fall-templates');
  });

  it('uses the selected category order and preserves the category return URL', async () => {
    state.params = new URLSearchParams('category=second');
    render(<AllTemplatesClient />);
    fireEvent.click(await screen.findByRole('button', { name: '템플릿 b' }));
    next();
    expect(dialog()).toHaveAccessibleName('템플릿 c');
    create();
    expect(state.router.push).toHaveBeenCalledWith('/reels-maker?templateId=c&returnUrl=%2Fall-templates%3Fcategory%3Dsecond');
  });

  it('previews paid templates while subscription data is loading and disables only creation', async () => {
    state.auth.isLoadingSubscription = true;
    const { rerender } = render(<AllTemplatesClient />);
    const trigger = await screen.findByRole('button', { name: '템플릿 a 상세 보기' });
    expect(trigger).toBeEnabled();
    fireEvent.click(trigger);
    expect(within(dialog()).getByRole('button', { name: '권한 확인 중...' })).toBeDisabled();
    next();
    expect(dialog()).toHaveAccessibleName('템플릿 b');
    state.auth.isLoadingSubscription = false;
    rerender(<AllTemplatesClient />);
    expect(within(dialog()).getByRole('button', { name: '3분 만에 만들러 가기' })).toBeEnabled();
  });

  it('lets unpaid users preview and checks their pass only at creation', async () => {
    state.auth.subscription.passActive = false;
    render(<AllTemplatesClient />);
    fireEvent.click(await screen.findByRole('button', { name: '템플릿 a 상세 보기' }));
    expect(state.router.push).not.toHaveBeenCalled();
    create();
    expect(state.router.push).toHaveBeenCalledWith('/pricing');
  });

  it('opens legacy direct links in the deduplicated full list and removes only templateId on close', async () => {
    state.params = new URLSearchParams('templateId=b&reason=select-template');
    render(<AllTemplatesClient />);
    await screen.findByRole('dialog');
    expect(dialog()).toHaveAccessibleName('템플릿 b');
    expect(within(dialog()).getByText('2 / 3 · 좌우로 넘겨보세요')).toBeInTheDocument();
    expect(state.router.push).not.toHaveBeenCalled();
    next();
    expect(dialog()).toHaveAccessibleName('템플릿 c');
    fireEvent.click(within(dialog()).getByRole('button', { name: '상세 닫기' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(state.router.replace).toHaveBeenCalledWith('/all-templates?reason=select-template', { scroll: false });
  });

  it('waits for first-visit onboarding before opening a direct link and reopens it after query navigation', async () => {
    state.params = new URLSearchParams('templateId=b');
    state.entranceCompleted = false;
    const { rerender } = render(<AllTemplatesClient />);
    await screen.findByRole('button', { name: '템플릿 b 상세 보기' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    state.entranceCompleted = true;
    rerender(<AllTemplatesClient />);
    expect(dialog()).toHaveAccessibleName('템플릿 b');
    fireEvent.click(within(dialog()).getByRole('button', { name: '상세 닫기' }));
    state.params = new URLSearchParams();
    rerender(<AllTemplatesClient />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    state.params = new URLSearchParams('templateId=b');
    rerender(<AllTemplatesClient />);
    expect(dialog()).toHaveAccessibleName('템플릿 b');
  });

  it.each([
    ['templateId=missing', '템플릿을 찾을 수 없습니다.'],
    ['templateId=coming', '아직 추가 예정인 템플릿입니다.'],
    ['category=first&templateId=c', '템플릿을 찾을 수 없습니다.'],
  ])('shows a safe message for %s instead of creating a reel', async (query, message) => {
    state.params = new URLSearchParams(query);
    render(<AllTemplatesClient />);
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(state.router.push).not.toHaveBeenCalled();
  });

  it('restores focus and body scrolling when native Escape cancellation closes the dialog', async () => {
    document.body.style.overflow = 'auto';
    render(<AllTemplatesClient />);
    const trigger = await screen.findByRole('button', { name: '템플릿 a 상세 보기' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(document.body.style.overflow).toBe('hidden');
    expect(within(dialog()).getByRole('button', { name: '상세 닫기' })).toHaveFocus();
    fireEvent.keyDown(dialog(), { key: 'ArrowRight' });
    expect(dialog()).toHaveAccessibleName('템플릿 b');
    fireEvent(dialog(), new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('auto');
    expect(trigger).toHaveFocus();
    document.body.style.overflow = '';
  });

  it('keeps the entire row of media previews mounted when navigating from the first card to the last', async () => {
    state.params = new URLSearchParams('templateId=a');
    render(<AllTemplatesClient />);
    await screen.findByRole('dialog');
    const media = within(dialog()).getAllByTestId('media');
    expect(media).toHaveLength(3);
    expect(media.map(node => node.dataset.embed)).toEqual([a.embedUrl, b.embedUrl, c.embedUrl]);
    expect(media[2].closest('[inert]')).not.toBeNull();
    next();
    next();
    expect(dialog()).toHaveAccessibleName('템플릿 c');
    expect(within(dialog()).getAllByTestId('media')).toEqual(media);
    expect(media[0].closest('[inert]')).not.toBeNull();
    expect(media[2].closest('[inert]')).toBeNull();
  });
});

describe('saved template preview flow', () => {
  it('opens from the details button, keeps saved order, and returns creation to the saved list', async () => {
    render(<SavedReelsClient />);
    const buttons = await screen.findAllByRole('button', { name: '상세 보기', exact: true });
    fireEvent.click(buttons[0]);
    expect(dialog()).toHaveAccessibleName('템플릿 c');
    expect(state.router.push).not.toHaveBeenCalled();
    next();
    expect(dialog()).toHaveAccessibleName('템플릿 a');
    create();
    expect(state.router.push).toHaveBeenCalledWith('/reels-maker?templateId=a&returnUrl=%2Fsaved-reels');
  });

  it('keeps the current card after unsaving the last saved template and permits re-saving', async () => {
    saved = [a];
    render(<SavedReelsClient />);
    fireEvent.click(await screen.findByRole('button', { name: '템플릿 a' }));
    expect(within(dialog()).getByRole('button', { name: '이전 템플릿' })).toBeDisabled();
    expect(within(dialog()).getByRole('button', { name: '다음 템플릿' })).toBeDisabled();
    fireEvent.click(within(dialog()).getByRole('button', { name: '템플릿 a 저장 취소' }));
    await waitFor(() => expect(within(dialog()).getByRole('button', { name: '템플릿 a 저장' })).toBeEnabled());
    expect(dialog()).toHaveAccessibleName('템플릿 a');
    expect(screen.getByText('저장된 릴스가 없습니다.')).toBeInTheDocument();
    fireEvent.click(within(dialog()).getByRole('button', { name: '템플릿 a 저장' }));
    await waitFor(() => expect(within(dialog()).getByRole('button', { name: '템플릿 a 저장 취소' })).toBeEnabled());
    fireEvent.click(within(dialog()).getByRole('button', { name: '상세 닫기' }));
    expect(screen.getByRole('button', { name: '템플릿 a 상세 보기' })).toBeInTheDocument();
  });

  it('shows save failures inside the modal without losing the card and allows retry', async () => {
    saveFailure = true;
    render(<SavedReelsClient />);
    fireEvent.click(await screen.findByRole('button', { name: '템플릿 c 상세 보기' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: '템플릿 c 저장 취소' }));
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent('저장 실패');
    expect(dialog()).toHaveAccessibleName('템플릿 c');
    saveFailure = false;
    fireEvent.click(within(dialog()).getByRole('button', { name: '템플릿 c 저장 취소' }));
    await waitFor(() => expect(within(dialog()).queryByRole('alert')).not.toBeInTheDocument());
    expect(within(dialog()).getByRole('button', { name: '템플릿 c 저장' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('guards repeated save clicks while a request is pending', async () => {
    render(<SavedReelsClient />);
    fireEvent.click(await screen.findByRole('button', { name: '템플릿 c 상세 보기' }));
    let resolveSave!: (value: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { resolveSave = resolve; }));
    const saveButton = within(dialog()).getByRole('button', { name: '템플릿 c 저장 취소' });
    fireEvent.click(saveButton);
    fireEvent.click(saveButton);
    expect(saveButton).toBeDisabled();
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/save'))).toHaveLength(1);
    await act(async () => resolveSave(response({ templateId: 'c', saved: false })));
  });
});
