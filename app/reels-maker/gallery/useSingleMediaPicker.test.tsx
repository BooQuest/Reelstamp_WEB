import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import useSingleMediaPicker from './useSingleMediaPicker';
import type { MediaTarget } from './types';

const target: MediaTarget = { sessionId: 10, clipId: 101, cutIndex: 0 };
function Picker({
  sessionId = 10,
  select,
  destination = target,
}: {
  sessionId?: number;
  select: (file: File, target: MediaTarget) => Promise<void>;
  destination?: MediaTarget;
}) {
  const { inputRef, open, onChange, error } = useSingleMediaPicker(
    sessionId,
    select,
  );
  return (
    <>
      <button onClick={() => open(destination)}>Choose</button>
      <input aria-label="File" type="file" ref={inputRef} onChange={onChange} />
      {error && <p role="alert">{error}</p>}
    </>
  );
}
const choose = (files: File[]) =>
  fireEvent.change(screen.getByLabelText('File'), { target: { files } });
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('single media picker', () => {
  it('opens synchronously and keeps the original destination across rerenders', () => {
    const select = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<Picker select={select} />);
    const click = vi.spyOn(screen.getByLabelText('File'), 'click');
    fireEvent.click(screen.getByText('Choose'));
    expect(click).toHaveBeenCalledTimes(1);
    rerender(
      <Picker
        select={select}
        destination={{ ...target, clipId: 103, cutIndex: 2 }}
      />,
    );
    const file = new File(['video'], 'clip.mp4', { type: 'video/mp4' });
    choose([file]);
    expect(select).toHaveBeenCalledWith(file, target);
  });
  it('ignores cancellation and allows the identical file to be selected again', () => {
    const select = vi.fn().mockResolvedValue(undefined);
    render(<Picker select={select} />);
    fireEvent.click(screen.getByText('Choose'));
    fireEvent(screen.getByLabelText('File'), new Event('cancel'));
    const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
    choose([file]);
    expect(select).not.toHaveBeenCalled();
    for (let i = 0; i < 2; i++) {
      fireEvent.click(screen.getByText('Choose'));
      choose([file]);
    }
    expect(select).toHaveBeenCalledTimes(2);
  });
  it('discards an outstanding selection when the session changes', () => {
    const select = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<Picker select={select} />);
    fireEvent.click(screen.getByText('Choose'));
    rerender(<Picker sessionId={20} select={select} />);
    choose([new File(['video'], 'clip.mp4', { type: 'video/mp4' })]);
    expect(select).not.toHaveBeenCalled();
  });
  it.each([
    [new File(['text'], 'text.txt', { type: 'text/plain' })],
    [new File([], 'empty.mp4', { type: 'video/mp4' })],
    [
      new File(['a'], 'a.mp4', { type: 'video/mp4' }),
      new File(['b'], 'b.mp4', { type: 'video/mp4' }),
    ],
  ])(
    'rejects unsupported, empty or multiple files and permits retry',
    (...files) => {
      const select = vi.fn().mockResolvedValue(undefined);
      render(<Picker select={select} />);
      fireEvent.click(screen.getByText('Choose'));
      choose(files);
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(select).not.toHaveBeenCalled();
      fireEvent.click(screen.getByText('Choose'));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      choose([new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })]);
      expect(select).toHaveBeenCalledTimes(1);
    },
  );
});
