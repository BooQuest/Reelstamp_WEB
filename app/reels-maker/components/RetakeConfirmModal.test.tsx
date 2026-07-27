import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RetakeConfirmModal from './RetakeConfirmModal';

describe('RetakeConfirmModal', () => {
  afterEach(() => {
    cleanup();
  });

  it('asks before replacing an existing clip with a new recording', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(<RetakeConfirmModal onCancel={onCancel} onConfirm={onConfirm} />);

    expect(screen.getByText('다시 촬영할까요?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    fireEvent.click(screen.getByRole('button', { name: '다시 촬영' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('supports a gallery replacement message', () => {
    const onConfirm = vi.fn();

    render(
      <RetakeConfirmModal
        title="파일로 교체할까요?"
        description="촬영된 영상은 새 파일이 저장되면 교체됩니다."
        confirmLabel="파일 선택"
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText('파일로 교체할까요?')).toBeInTheDocument();
    expect(
      screen.getByText('촬영된 영상은 새 파일이 저장되면 교체됩니다.')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '파일 선택' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
