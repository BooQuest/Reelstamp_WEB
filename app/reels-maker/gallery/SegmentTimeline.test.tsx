import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SegmentTimeline from './SegmentTimeline';

vi.mock('./useTimelineThumbnails', () => ({ default: () => null }));
const metadata = { width: 1920, height: 1080, duration: 10 };
const base = { start: 1, duration: 3, sourceUrl: 'blob:source', metadata, disabled: false };
beforeEach(() => {
  class TestPointerEvent extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? 'mouse';
    }
  }
  vi.stubGlobal('PointerEvent', TestPointerEvent);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it.each(['mouse', 'touch'])('slides the source opposite to %s dragging without resizing', (pointerType) => {
  const changed = vi.fn();
  function Harness() {
    const [start, setStart] = useState(1);
    return <SegmentTimeline {...base} start={start} onStartChange={(next) => { changed(next); setStart(next); }} />;
  }
  render(<Harness />);
  const slider = screen.getByRole('slider');
  slider.setPointerCapture = vi.fn();
  vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue({ width: 400 } as DOMRect);
  fireEvent.pointerDown(slider, { pointerId: 1, pointerType, clientX: 200 });
  fireEvent.pointerMove(slider, { pointerId: 1, pointerType, clientX: 100 });
  expect(changed).toHaveBeenLastCalledWith(2);
  expect(screen.getByText('종료 5.0s')).toBeInTheDocument();
  fireEvent.pointerMove(slider, { pointerId: 1, pointerType, clientX: -10000 });
  expect(changed).toHaveBeenLastCalledWith(7);
  fireEvent.pointerMove(slider, { pointerId: 1, pointerType, clientX: 10000 });
  expect(changed).toHaveBeenLastCalledWith(0);
  fireEvent.pointerCancel(slider, { pointerId: 1 });
  changed.mockClear();
  fireEvent.pointerMove(slider, { pointerId: 1, pointerType, clientX: 100 });
  expect(changed).not.toHaveBeenCalled();
});
it('supports tenth-second keyboard movement and source boundaries', () => {
  const changed = vi.fn();
  render(<SegmentTimeline {...base} onStartChange={changed} />);
  const slider = screen.getByRole('slider');
  for (const [key, value] of [['ArrowLeft', .9], ['ArrowRight', 1.1], ['Home', 0], ['End', 7]] as const) {
    fireEvent.keyDown(slider, { key });
    expect(changed).toHaveBeenLastCalledWith(value);
  }
});
it.each([.1, 3, 60])('keeps a centered 75 percent frame for a %s second selection', (duration) => {
  render(<SegmentTimeline {...base} duration={duration} metadata={{ ...metadata, duration: 7200 }} onStartChange={vi.fn()} />);
  expect(screen.getByTestId('segment-selection')).toHaveStyle({ left: '12.5%', width: '75%' });
  expect(screen.getAllByRole('slider')).toHaveLength(1);
});
it.each([10, 10.09])('locks movement when no complete tenth remains in a %s second source', (sourceDuration) => {
  const changed = vi.fn();
  render(<SegmentTimeline {...base} start={0} duration={10} metadata={{ ...metadata, duration: sourceDuration }} onStartChange={changed} />);
  const slider = screen.getByRole('slider');
  expect(slider).toHaveAttribute('aria-disabled', 'true');
  fireEvent.keyDown(slider, { key: 'End' });
  fireEvent.pointerDown(slider, { clientX: 100 });
  fireEvent.pointerMove(slider, { clientX: 0 });
  expect(changed).not.toHaveBeenCalled();
});
it('discards an active drag when applying starts or the duration changes', () => {
  const changed = vi.fn();
  const { rerender } = render(<SegmentTimeline {...base} onStartChange={changed} />);
  const slider = screen.getByRole('slider');
  slider.setPointerCapture = vi.fn();
  vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue({ width: 400 } as DOMRect);
  fireEvent.pointerDown(slider, { clientX: 200 });
  rerender(<SegmentTimeline {...base} disabled onStartChange={changed} />);
  fireEvent.pointerMove(slider, { clientX: 100 });
  rerender(<SegmentTimeline {...base} onStartChange={changed} />);
  fireEvent.pointerMove(slider, { clientX: 100 });
  expect(changed).not.toHaveBeenCalled();
  fireEvent.pointerDown(slider, { clientX: 200 });
  rerender(<SegmentTimeline {...base} duration={4} onStartChange={changed} />);
  fireEvent.pointerMove(slider, { clientX: 100 });
  expect(changed).not.toHaveBeenCalled();
});
