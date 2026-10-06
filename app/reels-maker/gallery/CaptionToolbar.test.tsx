import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import CaptionToolbar from './CaptionToolbar';
import { DEFAULT_CAPTION_STYLE } from '../constants';
afterEach(cleanup);
it('keeps keyboard focus while choosing every style category and exports V2', () => {
  const change = vi.fn();
  render(
    <>
      <textarea aria-label="text" />
      <CaptionToolbar
        style={DEFAULT_CAPTION_STYLE}
        onChange={change}
        onDone={vi.fn()}
        onDelete={vi.fn()}
      />
    </>,
  );
  const input = screen.getByLabelText('text');
  input.focus();
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Noto Serif KR' }));
  fireEvent.click(screen.getByRole('button', { name: 'Noto Serif KR' }));
  expect(document.activeElement).toBe(input);
  expect(change).toHaveBeenLastCalledWith(
    expect.objectContaining({
      styleVersion: 'CAPTION_RENDER_V2',
      fontFamily: 'ReelstampCaptionNotoSerif',
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: '스타일' }));
  fireEvent.click(screen.getByRole('button', { name: '굵게' }));
  expect(change).toHaveBeenLastCalledWith(
    expect.objectContaining({ textPreset: 'bold' }),
  );
  fireEvent.click(screen.getByRole('button', { name: '정렬' }));
  fireEvent.click(screen.getByRole('button', { name: '오른쪽' }));
  expect(change).toHaveBeenLastCalledWith(
    expect.objectContaining({ textAlign: 'right' }),
  );
  fireEvent.click(screen.getByRole('button', { name: '배경' }));
  fireEvent.click(screen.getByRole('button', { name: '반투명' }));
  expect(change).toHaveBeenLastCalledWith(
    expect.objectContaining({ boxBackgroundOpacity: 0.5 }),
  );
});
