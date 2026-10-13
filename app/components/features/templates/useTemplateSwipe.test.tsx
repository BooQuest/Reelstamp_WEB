import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useTemplateSwipe } from './useTemplateSwipe';

const previous = vi.fn();
const next = vi.fn();
const click = vi.fn();
function SwipeSurface() {
  const handlers = useTemplateSwipe(previous, next);
  return <div data-testid="surface" {...handlers}>
    <span data-testid="text">설명</span>
    <button onClick={click}>저장</button>
    <button data-instagram-playback-trigger="true" onClick={click}>재생</button>
  </div>;
}

beforeEach(() => {
  class TestPointerEvent extends MouseEvent {
    pointerId: number;
    isPrimary: boolean;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.isPrimary = init.isPrimary ?? true;
    }
  }
  vi.stubGlobal('PointerEvent', TestPointerEvent);
  render(<SwipeSurface />);
  const surface = screen.getByTestId('surface');
  surface.setPointerCapture = vi.fn();
  surface.hasPointerCapture = () => false;
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

function swipe(target: HTMLElement, x: number, y = 0) {
  fireEvent.pointerDown(target, { clientX: 200, clientY: 100, pointerId: 1, isPrimary: true, button: 0 });
  fireEvent.pointerUp(target, { clientX: 200 + x, clientY: 100 + y, pointerId: 1, isPrimary: true, button: 0 });
}

it('navigates in both directions only for intentional horizontal swipes', () => {
  const text = screen.getByTestId('text');
  swipe(text, -100);
  expect(next).toHaveBeenCalledTimes(1);
  swipe(text, 100);
  expect(previous).toHaveBeenCalledTimes(1);
  swipe(text, 20);
  swipe(text, 80, 120);
  expect(next).toHaveBeenCalledTimes(1);
  expect(previous).toHaveBeenCalledTimes(1);
});

it('does not turn button interactions or cancelled pointers into navigation', () => {
  const save = screen.getByRole('button', { name: '저장' });
  swipe(save, -100);
  fireEvent.click(save);
  expect(click).toHaveBeenCalledTimes(1);
  const text = screen.getByTestId('text');
  fireEvent.pointerDown(text, { clientX: 200, clientY: 100, isPrimary: true, button: 0 });
  fireEvent.pointerCancel(text);
  fireEvent.pointerUp(text, { clientX: 50, clientY: 100 });
  expect(next).not.toHaveBeenCalled();
  expect(previous).not.toHaveBeenCalled();
});

it('supports swiping the Instagram playback trigger without also opening playback', () => {
  const play = screen.getByRole('button', { name: '재생' });
  swipe(play, -100);
  fireEvent.click(play);
  expect(next).toHaveBeenCalledTimes(1);
  expect(click).not.toHaveBeenCalled();
  expect(screen.getByTestId('surface').setPointerCapture).not.toHaveBeenCalled();
  swipe(play, 0);
  fireEvent.click(play);
  expect(click).toHaveBeenCalledTimes(1);
});
