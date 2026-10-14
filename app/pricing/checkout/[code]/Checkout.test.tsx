import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import Checkout from './Checkout';
import LocaleProvider from '@/app/i18n/LocaleProvider';
import LanguageSelector from '@/app/i18n/LanguageSelector';
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
const product = {
  plan: 'PASS_1M',
  name: '1개월 이용권',
  regularPrice: 49500,
  salePrice: 9900,
  durationValue: 1,
  durationUnit: 'MONTH' as const,
  displayOrder: 1,
  version: 'version',
};
beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe('checkout retries', () => {
  it('reuses the same request key and phone after a lost response', async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('network failure'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ orderId: 'PASS-existing', payUrl: null }),
      });
    vi.stubGlobal('fetch', fetch);
    render(<Checkout product={product} userId={1} />);
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '01012345678' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: '1개월 이용권 구매하기' }),
    );
    await screen.findByRole('alert');
    fireEvent.click(
      screen.getByRole('button', { name: '1개월 이용권 구매하기' }),
    );
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        '/pricing/success?orderId=PASS-existing',
      ),
    );
    const first = JSON.parse(fetch.mock.calls[0][1].body);
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual(first);
    expect(first).not.toHaveProperty('price');
  });
  it('requires a fresh product review on a version conflict', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({
          ok: false,
          status: 409,
          clone: () => ({ json: async () => ({ message: '상품 정보가 변경되었습니다.' }) }),
          json: async () => ({ message: '상품 정보가 변경되었습니다.' }),
        }),
    );
    render(<Checkout product={product} userId={1} />);
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '01012345678' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: '1개월 이용권 구매하기' }),
    );
    expect(
      await screen.findByRole('link', { name: '변경된 이용권 확인하기' }),
    ).toHaveAttribute('href', '/pricing');
    expect(
      screen.queryByRole('button', { name: '1개월 이용권 구매하기' }),
    ).toBeNull();
  });
});

it('preserves phone and retry identity while names change language', async () => {
  const fetch = vi.fn().mockRejectedValue(new Error('Lost response'));
  vi.stubGlobal('fetch', fetch);
  const english = { ...product, name: '1-month pass', locale: 'en' as const };
  const ui = (value: typeof product & { locale?: 'ko' | 'en' }) => (
    <LocaleProvider initialLocale="ko" enabled>
      <LanguageSelector /><Checkout product={value} userId={1} />
    </LocaleProvider>
  );
  const view = render(ui(product));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '01012345678' } });
  fireEvent.click(screen.getByRole('button', { name: '1개월 이용권 구매하기' }));
  await screen.findByRole('alert');
  const first = JSON.parse(fetch.mock.calls[0][1].body);
  fireEvent.click(screen.getByRole('button', { name: 'English' }));
  expect(screen.queryByRole('heading', { name: '1개월 이용권' })).not.toBeInTheDocument();
  view.rerender(ui(english));
  expect(screen.getByRole('textbox')).toHaveValue('01012345678');
  expect(fetch).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Buy 1-month pass' }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  const second = JSON.parse(fetch.mock.calls[1][1].body);
  expect(second).toMatchObject({ idempotencyKey: first.idempotencyKey, version: first.version, phone: first.phone, locale: 'en' });
});

it('does not restart an in-flight purchase when the language changes', async () => {
  let complete!: (response: unknown) => void;
  const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<unknown>>(() => new Promise(resolve => { complete = resolve; }));
  vi.stubGlobal('fetch', fetch);
  const ui = (english: boolean) => <LocaleProvider initialLocale="ko" enabled><LanguageSelector />
    <Checkout userId={1} product={english ? { ...product, name: '1-month pass', locale: 'en' } : product} />
  </LocaleProvider>;
  const view = render(ui(false));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '01012345678' } });
  fireEvent.click(screen.getByRole('button', { name: '1개월 이용권 구매하기' }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: 'English' }));
  view.rerender(ui(true));
  expect(screen.getByRole('textbox')).toHaveValue('01012345678');
  expect(screen.getByRole('textbox')).toBeDisabled();
  expect(JSON.parse(String(fetch.mock.calls[0][1]?.body)).locale).toBe('ko');
  expect(fetch).toHaveBeenCalledTimes(1);
  await act(async () => complete({ ok: true, status: 200, json: async () => ({ orderId: 'PASS-once', payUrl: null }) }));
  expect(push).toHaveBeenCalledWith('/pricing/success?orderId=PASS-once');
  expect(fetch).toHaveBeenCalledTimes(1);
});
