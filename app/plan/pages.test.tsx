import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import PlanPage from './page';
import PaymentsPage from './payments/page';
import PaymentsClient from './payments/PaymentsClient';
import PlanClient from './PlanClient';

const { getUser, subscription, history, redirect, refresh } = vi.hoisted(() => ({
  getUser: vi.fn(),
  subscription: vi.fn(),
  history: vi.fn(),
  redirect: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('@/app/lib/api/auth', () => ({ getCurrentUser: getUser }));
vi.mock('@/app/actions/auth', () => ({ getSubscriptionStatusAction: subscription }));
vi.mock('@/app/lib/passes/server', () => ({ getPassGrants: async () => ({ grants: [], now: 0 }) }));
vi.mock('@/app/lib/passes/queries', () => ({ getPaymentHistory: history }));
vi.mock('next/navigation', () => ({ redirect, useRouter: () => ({ refresh }) }));

beforeEach(() => {
  vi.resetAllMocks();
  getUser.mockResolvedValue({ id: 1 });
  redirect.mockImplementation(() => {
    throw new Error('redirect');
  });
});
afterEach(cleanup);

describe('authenticated pass pages', () => {
  it.each([
    { page: PlanPage, path: '/plan' },
    { page: PaymentsPage, path: '/plan/payments' },
  ])(
    'preserves the $path login destination before reading private data',
    async ({ page, path }) => {
      getUser.mockResolvedValue(null);
      await expect(page()).rejects.toThrow('redirect');
      expect(redirect).toHaveBeenCalledWith(`/login?returnUrl=${encodeURIComponent(path)}`);
      expect(subscription).not.toHaveBeenCalled();
      expect(history).not.toHaveBeenCalled();
    },
  );

  it('shows a failed subscription lookup as an error with retry', async () => {
    subscription.mockResolvedValue({ success: false });
    render(await PlanPage());
    expect(screen.getByRole('alert')).toHaveTextContent('불러오지 못했습니다');
    expect(screen.queryByText('보유 이용권 없음')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('shows the recorded product and both navigation destinations', async () => {
    subscription.mockResolvedValue({
      success: true,
      data: {
        subscription: { active: true, currentPeriodStart: '2026-09-01', validUntil: '2026-09-30' },
        subscriptionPlan: { plan: 'PRO' },
      },
    });
    render(await PlanPage());
    expect(screen.getByRole('heading', { name: 'Pro' })).toBeInTheDocument();
    expect(screen.getByText('2026년 09월 30일')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '결제 내역 보기' })).toHaveAttribute(
      'href',
      '/plan/payments',
    );
    expect(screen.getByRole('link', { name: '이용권 알아보기' })).toHaveAttribute(
      'href',
      '/pricing',
    );
  });

  it('reads payment history for a logged-in user and distinguishes empty from error', async () => {
    history.mockResolvedValue({ status: 'ready', data: [] });
    const view = render(await PaymentsPage());
    expect(screen.getByText('아직 결제 내역이 없습니다.')).toBeInTheDocument();
    view.rerender(<PaymentsClient state={{ status: 'error' }} />);
    expect(screen.queryByText('아직 결제 내역이 없습니다.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('announces loading while waiting for data', () => {
    const view = render(<PlanClient state={{ status: 'loading' }} />);
    expect(screen.getByRole('status')).toHaveTextContent('이용권 정보를 불러오는 중');
    view.rerender(<PaymentsClient state={{ status: 'loading' }} />);
    expect(screen.getByRole('status')).toHaveTextContent('결제 내역을 불러오는 중');
  });
});
