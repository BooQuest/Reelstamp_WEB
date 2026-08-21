import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CaptureCaptionMenu from './CaptureCaptionMenu';

const baseProps = () => ({
  activeCutIndex: 0,
  overlayCaptionCount: 1,
  maxCaptions: 5,
  isBoxed: false,
  isAddDisabled: false,
  isToggleBoxDisabled: false,
  isDeleteDisabled: false,
  onAddCaption: vi.fn(),
  onToggleBox: vi.fn(),
  onDeleteCaption: vi.fn(),
});

describe('CaptureCaptionMenu', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('opens caption actions with current states', () => {
    render(<CaptureCaptionMenu {...baseProps()} isBoxed />);

    fireEvent.click(screen.getByRole('button', { name: /자막 편집/ }));

    expect(screen.getByRole('button', { name: '자막 추가 1/5' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '텍스트 박스 ON' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '선택 자막 삭제' })).toBeInTheDocument();
  });

  it('keeps disabled states from the parent', () => {
    render(
      <CaptureCaptionMenu
        {...baseProps()}
        overlayCaptionCount={5}
        isAddDisabled
        isToggleBoxDisabled
        isDeleteDisabled
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /자막 편집/ }));

    expect(screen.getByRole('button', { name: '자막 추가 5/5' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '텍스트 박스 OFF' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '선택 자막 삭제' })).toBeDisabled();
  });

  it('runs an action and closes the menu', () => {
    const props = baseProps();
    render(<CaptureCaptionMenu {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /자막 편집/ }));
    fireEvent.click(screen.getByRole('button', { name: '자막 추가 1/5' }));

    expect(props.onAddCaption).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes on outside click, escape, and active cut changes', () => {
    const { rerender } = render(<CaptureCaptionMenu {...baseProps()} />);

    fireEvent.click(screen.getByRole('button', { name: /자막 편집/ }));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /자막 편집/ }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /자막 편집/ }));
    rerender(<CaptureCaptionMenu {...baseProps()} activeCutIndex={1} />);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
