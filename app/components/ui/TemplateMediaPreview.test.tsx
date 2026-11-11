import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TemplateMediaPreview from './TemplateMediaPreview';

vi.mock('next/image', () => ({ default: ({ src, alt, onError }: { src: string; alt: string; onError: () => void }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={src} alt={alt} onError={onError} />
) }));
vi.mock('./InstagramEmbed', () => ({ default: ({ url }: { url: string }) => <iframe title="Instagram player" src={url} /> }));
const media = { title: 'Example', thumbnailUrl: 'https://media.test/poster.jpg', embedUrl: 'https://www.instagram.com/reel/example/' };
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('poster-first preview', () => {
  it('shows only a poster in a catalog card, including inside a clickable card', () => {
    const { container } = render(<button><TemplateMediaPreview {...media} disableEmbedInteraction /></button>);
    expect(screen.getByRole('img')).toHaveAttribute('src', media.thumbnailUrl);
    expect(container.querySelector('iframe,video')).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
  it('does not load Instagram to fill a missing or failed thumbnail', () => {
    const { container, rerender } = render(<TemplateMediaPreview {...media} />);
    fireEvent.error(screen.getByRole('img'));
    expect(container.querySelector('img,iframe,video')).toBeNull();
    rerender(<TemplateMediaPreview {...media} thumbnailUrl={null} playable />);
    expect(container.querySelector('iframe,video')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '예시 영상 재생' }));
    expect(screen.getByTitle('Instagram player')).toBeInTheDocument();
  });
  it('loads only after play and resets playback when a card is revisited or its source changes', () => {
    const { container, rerender, unmount } = render(<TemplateMediaPreview {...media} playable />);
    expect(container.querySelector('iframe')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '예시 영상 재생' }));
    expect(screen.getByTitle('Instagram player')).toBeInTheDocument();
    rerender(<TemplateMediaPreview {...media} playable disableEmbedInteraction />);
    expect(container.querySelector('iframe')).toBeNull();
    rerender(<TemplateMediaPreview {...media} playable />);
    expect(container.querySelector('iframe')).toBeNull();
    fireEvent.click(screen.getByRole('button'));
    rerender(<TemplateMediaPreview {...media} embedUrl="https://www.instagram.com/reel/another/" playable />);
    expect(container.querySelector('iframe')).toBeNull();
    unmount();
  });
  it('releases a direct video and never autoplays when returning to the card', () => {
    const props = { ...media, embedUrl: 'https://media.test/video.mp4' };
    const { container, rerender } = render(<TemplateMediaPreview {...props} playable />);
    fireEvent.click(screen.getByRole('button'));
    const video = container.querySelector('video')!;
    rerender(<TemplateMediaPreview {...props} />);
    expect(video).not.toHaveAttribute('src');
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    rerender(<TemplateMediaPreview {...props} playable />);
    expect(container.querySelector('video')).toBeNull();
  });
  it('does not expose a playback action for unsafe URLs', () => {
    const { container } = render(<TemplateMediaPreview title="Unsafe" embedUrl="javascript:alert(1)" playable />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.querySelector('iframe,video')).toBeNull();
  });
});
