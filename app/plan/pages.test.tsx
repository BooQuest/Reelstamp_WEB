import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import PlanPage from './page';
import PaymentsPage from './payments/page';
import PaymentsClient from './payments/PaymentsClient';
import PlanClient from './PlanClient';

const { getUser, subscription, grants, history, redirect, refresh } = vi.hoisted(() => ({
  getUser: vi.fn(),
  subscription: vi.fn(),
  grants: vi.fn(),
  history: vi.fn(),
  redirect: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('@/app/lib/api/auth', () => ({ getCurrentUser: getUser }));
vi.mock('@/app/actions/auth', () => ({ getSubscriptionStatusAction: subscription }));
vi.mock('@/app/lib/passes/server', () => ({ getPassGrants: grants }));
vi.mock('@/app/lib/passes/queries', () => ({ getPaymentHistory: history }));
vi.mock('next/navigation', () => ({ redirect, useRouter: () => ({ refresh }) }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('NEXT_PUBLIC_REELSTAMP_BETA_ENABLED', 'true');
  getUser.mockResolvedValue({ id: 1 });
  grants.mockResolvedValue({ grants: [], now: 0 });
  redirect.mockImplementation(() => {
    throw new Error('redirect');
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

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
    expect(screen.queryByText(/베타/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it.each([
    { plan: 'FREE', active: false, status: 'NONE', validUntil: null, label: '이용권 없음' },
    { plan: 'PRO', active: true, status: 'ACTIVE', validUntil: '2026-10-31', label: '사용 중' },
    { plan: 'PRO', active: false, status: 'CANCELED', validUntil: '2026-09-30', label: '기간 만료' },
  ])('preserves $label without a beta notice even when the beta flag is set', async (value) => {
    subscription.mockResolvedValue({
      success: true,
      data: {
        subscription: { active: value.active, status: value.status, validUntil: value.validUntil },
        subscriptionPlan: { plan: value.plan },
      },
    });
    render(await PlanPage());
    expect(screen.getByText(value.label)).toBeInTheDocument();
    expect(screen.queryByText(/베타/)).not.toBeInTheDocument();
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

  it('shows a registered Wadiz pass without beta or empty-pass notices', async () => {
    subscription.mockResolvedValue({
      success: true,
      data: { subscription: { status: 'NONE', active: false }, subscriptionPlan: { plan: 'FREE' } },
    });
    grants.mockResolvedValue({
      now: Date.parse('2026-10-10T00:00:00+09:00'),
      grants: [{
        id: 'coupon-1', source: 'COUPON', couponType: 'WADIZ',
        productName: '1주일 이용권 + 1개월 추가 혜택',
        durationValue: 37, durationUnit: 'DAY',
        startsAt: '2026-10-09T00:58:00+09:00', endsAt: '2026-11-15T00:58:00+09:00', revokedAt: null,
      }],
    });
    render(await PlanPage());
    expect(screen.getByText('와디즈 쿠폰 이용권')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '1주일 이용권 + 1개월 추가 혜택' })).toBeInTheDocument();
    expect(screen.getByText('사용 중')).toBeInTheDocument();
    expect(screen.queryByText(/베타/)).not.toBeInTheDocument();
    expect(screen.queryByText('보유한 이용권이 없습니다.')).not.toBeInTheDocument();
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
