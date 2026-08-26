import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CaptionOverlayStage from './CaptionOverlayStage';
import { DEFAULT_CAPTION_STYLE } from '../constants';
import type { CaptionItem } from '../types';

const caption: CaptionItem = {
  id: 'caption-1',
  text: '자막 테스트',
  source: 'USER',
  role: 'OVERLAY',
  placement: { type: 'CLIP', clipId: 10 },
  zIndex: 1,
  style: DEFAULT_CAPTION_STYLE,
};

const firePointerEvent = (
  element: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  {
    clientX,
    clientY,
    pointerId = 1,
  }: {
    clientX: number;
    clientY: number;
    pointerId?: number;
  }
) => {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
  });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  Object.defineProperty(event, 'pointerType', { value: 'touch' });
  fireEvent(element, event);
};

const renderStage = ({
  selectedCaptionId = 'caption-1',
  editingCaptionId = null,
}: {
  selectedCaptionId?: string | null;
  editingCaptionId?: string | null;
} = {}) => {
  const props = {
    captions: [caption],
    selectedCaptionId,
    editingCaptionId,
    previewScale: 0.3,
    stageRef: { current: null },
    overlayRef: { current: null },
    inputRef: { current: null },
    onSelect: vi.fn(),
    onEdit: vi.fn(),
    onTextChange: vi.fn(),
    onCaptionPointerDown: vi.fn(),
    onCaptionPointerMove: vi.fn(),
    onCaptionPointerEnd: vi.fn(),
    onResizePointerDown: vi.fn(),
    onResizePointerMove: vi.fn(),
    onResizePointerEnd: vi.fn(),
  };

  render(<CaptionOverlayStage {...props} />);

  const captionElement = screen.getByText('자막 테스트').closest('div');
  if (!captionElement) {
    throw new Error('Caption element was not rendered.');
  }

  return { captionElement, props };
};

describe('CaptionOverlayStage', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('suppresses edit click after dragging a selected caption', () => {
    const { captionElement, props } = renderStage();

    firePointerEvent(captionElement, 'pointerdown', {
      clientX: 100,
      clientY: 100,
    });
    firePointerEvent(captionElement, 'pointermove', {
      clientX: 120,
      clientY: 100,
    });
    firePointerEvent(captionElement, 'pointerup', {
      clientX: 120,
      clientY: 100,
    });
    fireEvent.click(captionElement);

    expect(props.onEdit).not.toHaveBeenCalled();
  });

  it('keeps tap-to-edit behavior for a selected caption', () => {
    const { captionElement, props } = renderStage();

    firePointerEvent(captionElement, 'pointerdown', {
      clientX: 100,
      clientY: 100,
    });
    firePointerEvent(captionElement, 'pointerup', {
      clientX: 100,
      clientY: 100,
    });
    fireEvent.click(captionElement);

    expect(props.onEdit).toHaveBeenCalledWith('caption-1');
  });
});
