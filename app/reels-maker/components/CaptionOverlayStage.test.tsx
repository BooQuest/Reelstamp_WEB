import { createRef } from 'react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import CaptionOverlayStage from './CaptionOverlayStage';
import CaptionToolbar from '../gallery/CaptionToolbar';
import { DEFAULT_CAPTION_STYLE } from '../constants';
import type { CaptionItem } from '../types';
afterEach(cleanup);
beforeAll(() => {
  class TestPointerEvent extends MouseEvent {
    pointerId: number;
    constructor(type: string, options: PointerEventInit = {}) {
      super(type, options);
      this.pointerId = options.pointerId ?? 1;
    }
  }
  window.PointerEvent = TestPointerEvent as typeof PointerEvent;
});
const caption: CaptionItem = {
  id: 'old',
  text: '가운데 정렬\n두 번째 줄',
  source: 'USER',
  role: 'OVERLAY',
  zIndex: 1,
  placement: { type: 'CLIP', clipId: 1 },
  style: { ...DEFAULT_CAPTION_STYLE, textAlign: 'left' },
};
function props() {
  return {
    captions: [caption],
    selectedCaptionId: null,
    editingCaptionId: null,
    previewScale: 0.3,
    stageRef: createRef<HTMLDivElement>(),
    overlayRef: createRef<HTMLDivElement>(),
    inputRef: createRef<HTMLTextAreaElement>(),
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
}
it('a single tap opens an unselected caption, without creating a new caption', () => {
  const p = props();
  const { container } = render(<CaptionOverlayStage {...p} />);
  fireEvent.click(container.querySelector('[data-caption-id="old"]')!);
  expect(p.onSelect).toHaveBeenCalledWith('old');
  expect(p.onEdit).toHaveBeenCalledWith('old');
});
it('drag, cancel and pinch do not open an editor', () => {
  const p = props();
  const { container } = render(<CaptionOverlayStage {...p} />);
  const node = container.querySelector('[data-caption-id="old"]')!;
  fireEvent.pointerDown(node, { pointerId: 1, clientX: 10 });
  fireEvent.pointerMove(node, { pointerId: 1, clientX: 30 });
  fireEvent.pointerUp(node, { pointerId: 1 });
  fireEvent.click(node);
  fireEvent.pointerDown(node, { pointerId: 1 });
  fireEvent.pointerCancel(node, { pointerId: 1 });
  fireEvent.click(node);
  fireEvent.pointerDown(node, { pointerId: 1 });
  fireEvent.pointerDown(node, { pointerId: 2 });
  fireEvent.pointerUp(node, { pointerId: 1 });
  fireEvent.pointerUp(node, { pointerId: 2 });
  fireEvent.click(node);
  expect(p.onEdit).not.toHaveBeenCalled();
  fireEvent.pointerDown(node, { pointerId: 1 });
  fireEvent.pointerUp(node, { pointerId: 1 });
  fireEvent.click(node);
  expect(p.onEdit).toHaveBeenCalledWith('old');
});
it('editing keeps the same measuring span, legacy alignment, and toolbar state', () => {
  const p = props();
  const { container, rerender } = render(<CaptionOverlayStage {...p} />);
  const node = container.querySelector(
    '[data-caption-id="old"]',
  ) as HTMLElement;
  const styles = node.style.cssText;
  const span = node.querySelector('span');
  rerender(<CaptionOverlayStage {...p} editingCaptionId="old" />);
  expect(node.style.cssText.replace('cursor: text', 'cursor: move')).toBe(
    styles,
  );
  expect(node.querySelector('span')).toBe(span);
  expect(screen.getByRole('textbox')).toHaveStyle({ textAlign: 'inherit' });
  expect(screen.getByRole('textbox')).toHaveAttribute('rows', '1');
  expect(p.onTextChange).not.toHaveBeenCalled();
  render(
    <CaptionToolbar
      style={caption.style}
      onChange={vi.fn()}
      onDone={vi.fn()}
      onDelete={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: '정렬' }));
  expect(screen.getByRole('button', { name: '가운데' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
it('keeps multiline and IME text changes and allows switching captions', () => {
  const p = props();
  const { container } = render(
    <CaptionOverlayStage
      {...p}
      editingCaptionId="old"
      captions={[caption, { ...caption, id: 'other', text: '다른 자막' }]}
    />,
  );
  const input = screen.getByRole('textbox');
  fireEvent.compositionStart(input);
  fireEvent.change(input, { target: { value: '한글\n둘째 줄' } });
  fireEvent.compositionEnd(input);
  expect(p.onTextChange).toHaveBeenCalledWith('한글\n둘째 줄');
  fireEvent.click(container.querySelector('[data-caption-id="other"]')!);
  expect(p.onEdit).toHaveBeenCalledWith('other');
});

it('ignores tap jitter and both synthetic clicks after a pinch', () => {
  const p = props();
  const { container } = render(<CaptionOverlayStage {...p} />);
  const node = container.querySelector('[data-caption-id="old"]')!;
  fireEvent.pointerDown(node, { pointerId: 1, clientX: 10 });
  fireEvent.pointerMove(node, { pointerId: 1, clientX: 12 });
  expect(p.onCaptionPointerMove).not.toHaveBeenCalled();
  fireEvent.pointerDown(node, { pointerId: 2, clientX: 30 });
  fireEvent.pointerUp(node, { pointerId: 1 });
  fireEvent.click(node);
  fireEvent.pointerUp(node, { pointerId: 2 });
  fireEvent.click(node);
  expect(p.onEdit).not.toHaveBeenCalled();
});
