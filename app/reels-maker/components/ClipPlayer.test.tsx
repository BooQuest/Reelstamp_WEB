import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ClipPlayer, { type ClipPlayerHandle } from './ClipPlayer';
const crop = { x: 0.25, y: 0, width: 0.5, height: 1 };
const clip = {
  url: 'blob:video',
  mimeType: 'video/mp4',
  duration: 2,
  kind: 'video' as const,
  edit: { start: 5, duration: 2, crop },
};
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
it('exposes cut-relative time while seeking the original and applying the crop', () => {
  const ref = createRef<ClipPlayerHandle>();
  render(<ClipPlayer clip={clip} ref={ref} />);
  const media = screen.getByLabelText('컷 영상 미리보기') as HTMLVideoElement;
  fireEvent.loadedMetadata(media);
  expect(media.currentTime).toBe(5);
  act(() => {
    ref.current!.currentTime = 1.3;
  });
  expect(media.currentTime).toBe(6.3);
  expect(ref.current!.currentTime).toBe(1.3);
  expect(media.style.width).toBe('200%');
  expect(media.style.left).toBe('-50%');
});
it('plays a photo on a virtual timeline without recording or making a video element', async () => {
  vi.useFakeTimers();
  const ref = createRef<ClipPlayerHandle>();
  const ended = vi.fn();
  render(
    <ClipPlayer
      clip={{
        ...clip,
        kind: 'image',
        duration: 0.1,
        edit: { ...clip.edit, start: 0, duration: 0.1 },
      }}
      ref={ref}
      onEnded={ended}
    />,
  );
  fireEvent.load(screen.getByLabelText('컷 사진 미리보기'));
  await act(async () => {
    await ref.current!.play();
  });
  act(() => {
    vi.advanceTimersByTime(200);
  });
  expect(ref.current!.ended).toBe(true);
  expect(ref.current!.paused).toBe(true);
  expect(ended).toHaveBeenCalledTimes(1);
  expect(document.querySelector('video')).toBeNull();
});
it('shows an error and reloads an image rather than displaying loading forever', () => {
  render(<ClipPlayer clip={{ ...clip, kind: 'image' }} />);
  const original = screen.getByLabelText('컷 사진 미리보기');
  fireEvent.error(original);
  expect(screen.getByRole('alert')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }));
  const replacement = screen.getByLabelText('컷 사진 미리보기');
  expect(replacement).not.toBe(original);
  fireEvent.load(replacement);
  expect(screen.queryByText('미리보기 준비 중…')).not.toBeInTheDocument();
});
