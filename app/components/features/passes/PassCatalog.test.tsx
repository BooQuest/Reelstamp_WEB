import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import PassCatalog from './PassCatalog';
import type { PassProduct } from '@/app/lib/passes/catalog';
const products: PassProduct[] = [
  {
    plan: 'PASS_7D',
    name: '1주일 체험권 test',
    salePrice: 1000,
    durationValue: 7,
    durationUnit: 'DAY',
    displayOrder: 1,
    version: 'test',
  },
  {
    plan: 'PASS_1M',
    name: '1개월 이용권',
    salePrice: 9900,
    durationValue: 1,
    durationUnit: 'MONTH',
    displayOrder: 2,
    version: 'test',
  },
];
afterEach(cleanup);
describe('test purchase buttons', () => {
  it('only enables the product authorized by the server', () => {
    render(
      <PassCatalog
        products={products}
        canPurchase
        allowedProductCodes={['PASS_7D']}
      />,
    );
    expect(
      screen.getByRole('link', { name: '1주일 체험권 test 구매하기' }),
    ).toHaveAttribute('href', '/pricing/checkout/PASS_7D');
    expect(screen.getByRole('button', { name: '출시 예정' })).toBeDisabled();
    expect(screen.getByText('1,000원')).toBeInTheDocument();
  });
  it('keeps purchases disabled for accounts without permission', () => {
    render(
      <PassCatalog
        products={products}
        canPurchase={false}
        allowedProductCodes={[]}
      />,
    );
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(2);
    screen
      .getAllByRole('button')
      .forEach((button) => expect(button).toBeDisabled());
  });
});
