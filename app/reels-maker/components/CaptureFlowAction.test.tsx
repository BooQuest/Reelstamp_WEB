import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CaptureFlowAction from './CaptureFlowAction';

describe('CaptureFlowAction', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders nothing when no flow action is available', () => {
    const { container } = render(
      <CaptureFlowAction
        variant={null}
        disabled={false}
        onNext={vi.fn()}
        onComplete={vi.fn()}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('calls next handler for the next cut action', () => {
    const onNext = vi.fn();
    const onComplete = vi.fn();
    render(
      <CaptureFlowAction
        variant="next"
        disabled={false}
        onNext={onNext}
        onComplete={onComplete}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '다음 컷 촬영' }));

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('calls complete handler for the complete action', () => {
    const onNext = vi.fn();
    const onComplete = vi.fn();
    render(
      <CaptureFlowAction
        variant="complete"
        disabled={false}
        onNext={onNext}
        onComplete={onComplete}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '완료하기' }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();
  });
});
