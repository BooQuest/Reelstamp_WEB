import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import PaymentResult from './PaymentResult';
import LocaleProvider from '@/app/i18n/LocaleProvider';
import LanguageSelector from '@/app/i18n/LanguageSelector';
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
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

it('discards a late Korean response after switching to English', async () => {
  let resolveKorean!: (value: unknown) => void;
  const fetch = vi.fn((url: string) => url.endsWith('locale=ko')
    ? new Promise(resolve => { resolveKorean = resolve; })
    : Promise.resolve({ ok: true, json: async () => ({ status: 'PAID', productName: '구매 당시 이름',
        displayProductName: '1-month pass', displayLocale: 'en', price: 9900 }) }));
  vi.stubGlobal('fetch', fetch);
  render(<LocaleProvider initialLocale="ko" enabled><LanguageSelector /><PaymentResult orderId="PASS-test" /></LocaleProvider>);
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: 'English' }));
  await screen.findByText(/1-month pass/);
  await act(async () => resolveKorean({ ok: true, json: async () => ({ status: 'PAID', productName: '구매 당시 이름',
    displayProductName: '한국어 이름', displayLocale: 'ko', price: 9900 }) }));
  expect(screen.getByText(/1-month pass/)).toBeInTheDocument();
  expect(screen.queryByText(/한국어 이름|구매 당시 이름/)).not.toBeInTheDocument();
});
