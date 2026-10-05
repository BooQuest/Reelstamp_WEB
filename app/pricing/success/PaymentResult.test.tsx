import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import PaymentResult from './PaymentResult';
vi.mock('@/app/components/providers/AuthProvider', () => ({
  useAuth: () => ({
    refreshSubscription: vi.fn().mockResolvedValue(undefined),
  }),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe('verified payment result', () => {
  it('never assumes success from arriving at the page', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    render(<PaymentResult orderId="PASS-test" />);
    expect(screen.getByRole('heading')).toHaveTextContent('결제 확인 중');
    expect(screen.queryByText('결제 완료')).toBeNull();
  });
  it('keeps virtual account issuance separate from payment completion', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'WAITING_DEPOSIT',
          productName: '1개월 이용권',
          price: 9900,
        }),
      }),
    );
    render(<PaymentResult orderId="PASS-test" />);
    expect(
      await screen.findByRole('heading', { name: '입금 대기' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('결제 완료')).toBeNull();
  });
  it('only displays completion after a verified order response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'PAID',
          productName: '1개월 이용권',
          price: 9900,
        }),
      }),
    );
    render(<PaymentResult orderId="PASS-test" />);
    expect(
      await screen.findByRole('heading', { name: '결제 완료' }),
    ).toBeInTheDocument();
  });
});
