import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import InstagramEmbed from './InstagramEmbed';

const REEL_URL = 'https://www.instagram.com/some_creator/reel/ABC123/?utm_source=test';

describe('InstagramEmbed', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the playback fallback after playback is attempted for Instagram-only reels', () => {
    render(<InstagramEmbed url={REEL_URL} instagramOnly />);

    expect(
      screen.queryByText('해당 릴스는 인스타그램에서만 재생됩니다.')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '인스타그램 릴스 재생' }));

    expect(
      screen.getByText('해당 릴스는 인스타그램에서만 재생됩니다.')
    ).toBeInTheDocument();
    expect(screen.getByText('인스타그램으로 이동할까요?')).toBeInTheDocument();
  });

  it('links the fallback action to the canonical Instagram reel URL', () => {
    render(<InstagramEmbed url={REEL_URL} instagramOnly />);

    fireEvent.click(screen.getByRole('button', { name: '인스타그램 릴스 재생' }));

    expect(screen.getByRole('link', { name: '이동하기' })).toHaveAttribute(
      'href',
      'https://www.instagram.com/reel/ABC123/'
    );
  });

  it('closes the playback fallback when cancel is clicked', () => {
    render(<InstagramEmbed url={REEL_URL} instagramOnly />);

    fireEvent.click(screen.getByRole('button', { name: '인스타그램 릴스 재생' }));
    fireEvent.click(screen.getByRole('button', { name: '취소' }));

    expect(
      screen.queryByText('해당 릴스는 인스타그램에서만 재생됩니다.')
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '인스타그램 릴스 재생' })
    ).toBeInTheDocument();
  });

  it('marks the playback trigger so carousel pointer capture can skip it', () => {
    render(<InstagramEmbed url={REEL_URL} instagramOnly />);

    expect(
      screen.getByRole('button', { name: '인스타그램 릴스 재생' })
    ).toHaveAttribute('data-instagram-playback-trigger', 'true');
  });

  it('reports playback fallback visibility changes', () => {
    const onVisibilityChange = vi.fn();

    render(
      <InstagramEmbed
        url={REEL_URL}
        instagramOnly
        onPlaybackFallbackVisibilityChange={onVisibilityChange}
      />
    );

    expect(onVisibilityChange).toHaveBeenLastCalledWith(false);

    fireEvent.click(screen.getByRole('button', { name: '인스타그램 릴스 재생' }));

    expect(onVisibilityChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(screen.getByRole('button', { name: '취소' }));

    expect(onVisibilityChange).toHaveBeenLastCalledWith(false);
  });

  it('does not show the playback fallback for swipe gestures', () => {
    render(<InstagramEmbed url={REEL_URL} instagramOnly />);

    const playbackButton = screen.getByRole('button', {
      name: '인스타그램 릴스 재생',
    });

    fireEvent.mouseDown(playbackButton, {
      clientX: 120,
      clientY: 120,
    });
    fireEvent.mouseMove(playbackButton, {
      clientX: 40,
      clientY: 124,
    });
    fireEvent.click(playbackButton);

    expect(
      screen.queryByText('해당 릴스는 인스타그램에서만 재생됩니다.')
    ).not.toBeInTheDocument();
  });

  it('keeps the iframe behavior without the fallback for regular reels', () => {
    render(<InstagramEmbed url={REEL_URL} />);

    expect(
      screen.queryByText('해당 릴스는 인스타그램에서만 재생됩니다.')
    ).not.toBeInTheDocument();
    expect(screen.getByTitle('Instagram 릴스')).toHaveAttribute(
      'src',
      'https://www.instagram.com/reel/ABC123/embed/'
    );
    expect(
      screen.queryByRole('button', { name: '인스타그램 릴스 재생' })
    ).not.toBeInTheDocument();
  });

  it('does not show the fallback when the parent disables fallback interactions', () => {
    render(
      <InstagramEmbed
        url={REEL_URL}
        instagramOnly
        showPlaybackFallback={false}
      />
    );

    expect(
      screen.queryByText('해당 릴스는 인스타그램에서만 재생됩니다.')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '인스타그램 릴스 재생' })
    ).not.toBeInTheDocument();
  });
});
