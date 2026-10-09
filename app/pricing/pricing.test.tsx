import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import PricingPage from './page';
import Checkout from './checkout/[code]/Checkout';
import { parseProducts } from '@/app/lib/passes/catalog';

const { getProducts, getAvailability } = vi.hoisted(() => ({
  getProducts: vi.fn(),
  getAvailability: vi.fn(),
}));
vi.mock('@/app/lib/passes/server', () => ({
  getPassProducts: getProducts,
  getPassAvailability: getAvailability,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const prices = [
  { plan: 'PASS_7D', name: '1주일 체험권', regularPrice: 4900, salePrice: 4900, discount: null },
  { plan: 'PASS_1M', name: '1개월 이용권', regularPrice: 49500, salePrice: 9900, discount: '80% 할인' },
  { plan: 'PASS_3M', name: '3개월 이용권', regularPrice: 146850, salePrice: 27900, discount: '81% 할인' },
  { plan: 'PASS_1Y', name: '1년 이용권', regularPrice: 582360, salePrice: 99000, discount: '83% 할인' },
];
const products = parseProducts(prices.map((row, index) => ({
  ...row,
  price: { regularPrice: row.regularPrice },
  durationValue: [7, 1, 3, 1][index],
  durationUnit: ['DAY', 'MONTH', 'MONTH', 'YEAR'][index],
  displayOrder: index,
  version: 'test',
})));

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('NEXT_PUBLIC_REELSTAMP_BETA_ENABLED', 'true');
  getProducts.mockResolvedValue(products);
  getAvailability.mockResolvedValue({ canPurchase: true, allowedProductCodes: prices.map(p => p.plan) });
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('pass pricing after launch', () => {
  it('shows the same DB prices and discounts in the catalog and checkout without beta notices', async () => {
    const view = render(await PricingPage());
    expect(screen.queryByText(/베타/)).not.toBeInTheDocument();
    screen.getAllByRole('article').forEach((card, index) => {
      const expected = prices[index];
      const scope = within(card);
      expect(scope.getByText(`${expected.salePrice.toLocaleString('ko-KR')}원`)).toBeInTheDocument();
      if (expected.discount) {
        expect(scope.getByText(expected.discount)).toBeInTheDocument();
        expect(scope.getByText(`${expected.regularPrice.toLocaleString('ko-KR')}원`).tagName).toBe('DEL');
      } else {
        expect(card.querySelector('del')).toBeNull();
        expect(scope.queryByText(/% 할인/)).toBeNull();
      }
    });

    products.forEach((product, index) => {
      view.rerender(<Checkout product={product} userId={1} />);
      const expected = prices[index];
      expect(screen.getByText(`${expected.salePrice.toLocaleString('ko-KR')}원`)).toBeInTheDocument();
      expect(screen.getByText('1회 결제 · 자동갱신 없음')).toBeInTheDocument();
      if (expected.discount) {
        expect(screen.getByText(expected.discount)).toBeInTheDocument();
        expect(screen.getByText(`${expected.regularPrice.toLocaleString('ko-KR')}원`).tagName).toBe('DEL');
      } else {
        expect(view.container.querySelector('del')).toBeNull();
        expect(screen.queryByText(/% 할인/)).toBeNull();
      }
    });
  });

  it.each([null, 0, -1, 1.5, NaN, Infinity, 9900, 4900])(
    'shows only the sale price when regularPrice is %s',
    (regularPrice) => {
      const view = render(<Checkout product={{ ...products[1], regularPrice }} userId={1} />);
      expect(screen.getByText('9,900원')).toBeInTheDocument();
      expect(view.container.querySelector('del')).toBeNull();
      expect(screen.queryByText(/% 할인/)).toBeNull();
    },
  );
});
