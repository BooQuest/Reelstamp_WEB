import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import Checkout from './Checkout';
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
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
