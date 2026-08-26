import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CutMediaSourceModal from './CutMediaSourceModal';

describe('CutMediaSourceModal', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows video capture and gallery actions only', () => {
    render(
      <CutMediaSourceModal
        isBusy={false}
        onClose={vi.fn()}
        onSelectVideoCapture={vi.fn()}
        onSelectGallery={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: '영상 촬영' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '갤러리' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '사진 촬영' })).not.toBeInTheDocument();
  });

  it('calls the selected action handlers', () => {
    const onSelectVideoCapture = vi.fn();
    const onSelectGallery = vi.fn();
    const onClose = vi.fn();

    render(
      <CutMediaSourceModal
        isBusy={false}
        onClose={onClose}
        onSelectVideoCapture={onSelectVideoCapture}
        onSelectGallery={onSelectGallery}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '영상 촬영' }));
    fireEvent.click(screen.getByRole('button', { name: '갤러리' }));
    fireEvent.click(screen.getByRole('button', { name: '미디어 추가 닫기' }));

    expect(onSelectVideoCapture).toHaveBeenCalledTimes(1);
    expect(onSelectGallery).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
