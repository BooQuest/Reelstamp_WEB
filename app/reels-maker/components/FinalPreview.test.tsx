import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { authFetch } from '@/app/lib/auth/browser-session';
import FinalPreview from './FinalPreview';

vi.mock('@/app/lib/auth/browser-session', () => ({ authFetch: vi.fn() }));
const bgmUrl = 'https://www.instagram.com/reels/audio/28388098380857597/';

// jsdom has no native modal implementation. Browser QA covers focus/keyboard behavior.
beforeAll(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value() { this.setAttribute('open', ''); } },
    close: { configurable: true, value() { this.removeAttribute('open'); } },
  });
});
afterAll(() => {
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});
beforeEach(() => {
  localStorage.clear();
  vi.spyOn(window, 'open').mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function setup(overrides: Partial<React.ComponentProps<typeof FinalPreview>> = {}) {
  const props = {
    sessionId: 10, finalVideoUrl: 'https://media.test/final.mp4', finalVideoMimeType: 'video/mp4',
    finalPosterUrl: null, templateTitle: '테스트', downloadToastMessage: null, isPreviewOpen: false,
    onOpenPreview: vi.fn(), onClosePreview: vi.fn(), onDownload: vi.fn(), onDone: vi.fn(), onShared: vi.fn(),
    bgmTitle: '오리지널 오디오 · judysfamilycafe', bgmUrl,
    ...overrides,
  };
  render(<FinalPreview {...props} />);
  return props;
}

function openGuide() {
  fireEvent.click(screen.getByRole('button', { name: 'BGM과 함께 업로드' }));
  return screen.getByRole('dialog', { name: 'BGM과 함께 업로드' });
}

describe('completion BGM flow', () => {
  it('shows the recommendation and prioritizes BGM over the existing share/download actions', () => {
    setup();
    expect(screen.getByText('추천 BGM · 오리지널 오디오 · judysfamilycafe')).toBeInTheDocument();
    const actions = screen.getAllByRole('button').filter(button =>
      ['BGM과 함께 업로드', '인스타그램에 공유', '영상 다운로드'].includes(button.textContent ?? ''));
    expect(actions.map(button => button.textContent)).toEqual(['BGM과 함께 업로드', '인스타그램에 공유', '영상 다운로드']);
    expect(actions[0]).toHaveClass('bg-[#FF4D6D]');
    expect(actions[1]).toHaveClass('bg-[#2B3446]');
    expect(screen.queryByRole('button', { name: '새로운 릴스 만들기' })).not.toBeInTheDocument();
  });

  it.each([
    { bgmTitle: undefined, bgmUrl: undefined }, { bgmTitle: null, bgmUrl: null },
    { bgmTitle: 'Song', bgmUrl: 'https://evil.test/audio/123' },
  ])('keeps normal sharing primary without a valid BGM: %o', (overrides) => {
    setup(overrides);
    expect(screen.queryByRole('button', { name: 'BGM과 함께 업로드' })).not.toBeInTheDocument();
    expect(screen.queryByText(/추천 BGM/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '인스타그램에 공유' })).toHaveClass('bg-[#FF4D6D]');
  });

  it('opens the guide first, then requests download and opens audio synchronously in that order', () => {
    const calls: string[] = [];
    vi.mocked(window.open).mockImplementation(() => { calls.push('audio'); return null; });
    const props = setup({ onDownload: vi.fn(() => { calls.push('download'); }) });
    const dialog = openGuide();
    expect(props.onDownload).not.toHaveBeenCalled();
    expect(window.open).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: '영상 다운로드 후 BGM 열기' }));
    expect(calls).toEqual(['download', 'audio']);
    expect(window.open).toHaveBeenCalledWith(bgmUrl, '_blank', 'noopener,noreferrer');
    expect(screen.getByRole('button', { name: '영상 다운로드' })).toBeEnabled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.length).toBe(0);
    expect(openGuide()).toBeInTheDocument();
  });

  it('shows the unchecked preference above the download button without the removed copy or links', () => {
    setup();
    const dialog = openGuide();
    const checkbox = within(dialog).getByRole('checkbox', { name: '다시 보지 않기' });
    expect(checkbox).not.toBeChecked();
    const download = within(dialog).getByRole('button', { name: '영상 다운로드 후 BGM 열기' });
    expect(checkbox.compareDocumentPosition(download) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(dialog).queryByText(/다운로드가 끝난 뒤 Instagram에서/)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/자동으로 열리지 않으면/)).not.toBeInTheDocument();
    expect(within(dialog).queryByText('이미 저장했어요 · BGM 열기')).not.toBeInTheDocument();
  });

  it('closes the guide with the close button or native Escape cancellation', () => {
    setup();
    openGuide();
    fireEvent.click(screen.getByRole('button', { name: 'BGM 안내 닫기' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent(openGuide(), new Event('cancel', { bubbles: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('retains standalone download, the existing success toast, and the Done action', () => {
    const props = setup({ downloadToastMessage: '다운로드 완료!' });
    fireEvent.click(screen.getByRole('button', { name: '영상 다운로드' }));
    expect(props.onDownload).toHaveBeenCalledOnce();
    expect(window.open).not.toHaveBeenCalled();
    expect(screen.getByText('다운로드 완료!')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '완료' }));
    expect(props.onDone).toHaveBeenCalledOnce();
  });

  it('does not start a BGM flow before the completed session and video are ready', () => {
    setup({ sessionId: null, finalVideoUrl: null });
    expect(screen.getByRole('button', { name: 'BGM과 함께 업로드' })).toBeDisabled();
  });

  it('shows iPhone saving instructions', () => {
    vi.stubGlobal('navigator', { userAgent: 'iPhone', platform: 'iPhone', maxTouchPoints: 1 });
    setup();
    openGuide();
    expect(screen.getByText(/파일 앱에 저장되었다면/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'BGM 링크 복사' })).not.toBeInTheDocument();
  });

  it('copies the BGM link on desktop and keeps a selectable URL when copying fails', async () => {
    const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('denied'));
    vi.stubGlobal('navigator', { userAgent: 'Desktop', platform: 'MacIntel', maxTouchPoints: 0, clipboard: { writeText } });
    setup();
    openGuide();
    expect(screen.getByText(/PC에서 다운로드한 영상/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'BGM 링크 복사' }));
    await screen.findByText('BGM 링크를 복사했어요.');
    expect(writeText).toHaveBeenCalledWith(bgmUrl);
    fireEvent.click(screen.getByRole('button', { name: 'BGM 링크 복사' }));
    await screen.findByText(/복사하지 못했어요/);
    expect(screen.getByRole('textbox', { name: 'BGM 링크' })).toHaveValue(bgmUrl);
  });

  it('preserves existing mobile video sharing without opening a BGM page', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { userAgent: 'Android', platform: 'Linux', maxTouchPoints: 1, share, canShare: () => true });
    vi.mocked(authFetch).mockResolvedValue(new Response(new Blob(['video'], { type: 'video/mp4' })));
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: '인스타그램에 공유' }));
    await waitFor(() => expect(share).toHaveBeenCalledOnce());
    expect(authFetch).toHaveBeenCalledWith('/api/reels-maker/download?sessionId=10', { cache: 'no-store' });
    expect(share.mock.calls[0][0].files[0]).toBeInstanceOf(File);
    expect(props.onShared).toHaveBeenCalledWith('공유 창을 열었어요.');
    expect(window.open).not.toHaveBeenCalled();
  });
});

describe('BGM guide dismissal preference', () => {
  it('does not persist or trigger any action when only the checkbox is changed', () => {
    const props = setup();
    openGuide();
    fireEvent.click(screen.getByRole('checkbox', { name: '다시 보지 않기' }));
    expect(localStorage.length).toBe(0);
    expect(props.onDownload).not.toHaveBeenCalled();
    expect(window.open).not.toHaveBeenCalled();
    cleanup();
    setup();
    expect(within(openGuide()).getByRole('checkbox')).not.toBeChecked();
  });

  it.each(['영상 다운로드 후 BGM 열기', 'BGM 안내 닫기'])(
    'persists on checked %s, then skips the guide for other templates after remounting', (action) => {
      const props = setup();
      openGuide();
      fireEvent.click(screen.getByRole('checkbox', { name: '다시 보지 않기' }));
      fireEvent.click(screen.getByRole('button', { name: action }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(props.onDownload).toHaveBeenCalledTimes(action === '영상 다운로드 후 BGM 열기' ? 1 : 0);
      expect(window.open).toHaveBeenCalledTimes(action === '영상 다운로드 후 BGM 열기' ? 1 : 0);
      cleanup();
      vi.mocked(window.open).mockClear();
      const calls: string[] = [];
      vi.mocked(window.open).mockImplementation(() => { calls.push('audio'); return null; });
      const otherUrl = 'https://www.instagram.com/reels/audio/631817623935543/';
      const next = setup({ bgmTitle: 'Feeling Good', bgmUrl: otherUrl, onDownload: vi.fn(() => { calls.push('download'); }) });
      fireEvent.click(screen.getByRole('button', { name: 'BGM과 함께 업로드' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(next.onDownload).toHaveBeenCalledOnce();
      expect(window.open).toHaveBeenCalledWith(otherUrl, '_blank', 'noopener,noreferrer');
      expect(calls).toEqual(['download', 'audio']);
    },
  );

  it.each(['escape', 'backdrop'])('discards the checked preference on %s', (action) => {
    setup();
    const dialog = openGuide();
    fireEvent.click(screen.getByRole('checkbox', { name: '다시 보지 않기' }));
    if (action === 'escape') fireEvent(dialog, new Event('cancel', { bubbles: true }));
    else fireEvent.click(dialog);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.length).toBe(0);
    expect(within(openGuide()).getByRole('checkbox')).not.toBeChecked();
  });

  it.each(['영상 다운로드 후 BGM 열기', 'BGM 안내 닫기'])(
    'does not persist on %s if the checkbox was checked and then unchecked', (action) => {
      setup();
      openGuide();
      const checkbox = screen.getByRole('checkbox', { name: '다시 보지 않기' });
      fireEvent.click(checkbox);
      fireEvent.click(checkbox);
      fireEvent.click(screen.getByRole('button', { name: action }));
      expect(localStorage.length).toBe(0);
      expect(openGuide()).toBeInTheDocument();
    },
  );

  it.each(['영상 다운로드 후 BGM 열기', 'BGM 안내 닫기'])(
    'still handles %s when browser storage is unavailable', (action) => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
      const props = setup();
      openGuide();
      fireEvent.click(screen.getByRole('checkbox', { name: '다시 보지 않기' }));
      fireEvent.click(screen.getByRole('button', { name: action }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(props.onDownload).toHaveBeenCalledTimes(action === '영상 다운로드 후 BGM 열기' ? 1 : 0);
      expect(openGuide()).toBeInTheDocument();
    },
  );
});
