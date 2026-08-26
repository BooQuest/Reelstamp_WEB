import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import SequentialServiceNoticePopups, {
  SERVICE_NOTICE_STORAGE_KEY_PREFIX,
} from './SequentialServiceNoticePopups';

const activeDate = new Date('2026-08-26T00:00:00+09:00');
const inactiveDate = new Date('2026-09-09T00:00:00+09:00');

describe('SequentialServiceNoticePopups', () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    document.body.style.overflow = '';
  });

  it('shows the two temporary notices in order', async () => {
    render(<SequentialServiceNoticePopups referenceDate={activeDate} />);

    expect(
      await screen.findByRole('heading', {
        name: '베타 서비스 기간 안내(8/26~9/8)',
      })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '확인' }));

    expect(
      await screen.findByRole('heading', {
        name: '일부 기능 안정화 작업 안내',
      })
    ).toBeInTheDocument();
  });

  it('stores dismissal for the current notice only when checked', async () => {
    render(<SequentialServiceNoticePopups referenceDate={activeDate} />);

    await screen.findByRole('heading', {
      name: '베타 서비스 기간 안내(8/26~9/8)',
    });

    fireEvent.click(screen.getByLabelText('다시 보지 않기'));
    fireEvent.click(screen.getByRole('button', { name: '확인' }));

    expect(
      window.localStorage.getItem(
        `${SERVICE_NOTICE_STORAGE_KEY_PREFIX}:beta-service-period`
      )
    ).toBe('true');
    expect(
      window.localStorage.getItem(
        `${SERVICE_NOTICE_STORAGE_KEY_PREFIX}:feature-stabilization`
      )
    ).toBeNull();
  });

  it('does not show the notices outside the configured period', () => {
    render(<SequentialServiceNoticePopups referenceDate={inactiveDate} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
