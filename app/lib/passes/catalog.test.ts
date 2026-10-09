import { describe, expect, it } from 'vitest';
import { durationLabel, parseProducts } from './catalog';
const product = {
  plan: 'PASS_7D',
  name: 'DB에서 바꾼 이름',
  price: { regularPrice: 10200 },
  salePrice: 5100,
  durationValue: 8,
  durationUnit: 'DAY',
  displayOrder: 1,
  version: 'revision',
};
describe('database catalog', () => {
  it('uses DB name, price and calendar duration without static fallback', () => {
    const [parsed] = parseProducts([product]);
    expect(parsed.name).toBe('DB에서 바꾼 이름');
    expect(parsed.salePrice).toBe(5100);
    expect(parsed.regularPrice).toBe(10200);
    expect(durationLabel(parsed)).toBe('8일');
    expect(durationLabel({ durationValue: 1, durationUnit: 'MONTH' })).toBe(
      '1개월',
    );
    expect(durationLabel({ durationValue: 1, durationUnit: 'YEAR' })).toBe(
      '1년',
    );
  });
  it.each([undefined, null, {}, { regularPrice: null }, { regularPrice: '10200' },
    { regularPrice: 0 }, { regularPrice: -1 }, { regularPrice: 1.5 },
    { regularPrice: Infinity }, { regularPrice: NaN },
    { regularPrice: Number.MAX_SAFE_INTEGER + 1 },
  ])('keeps the sale price when the regular price is unavailable: %j', (price) => {
    const [parsed] = parseProducts([{ ...product, price }]);
    expect(parsed.regularPrice).toBeNull();
    expect(parsed.salePrice).toBe(5100);
  });
  it.each([
    { ...product, salePrice: -1 },
    { ...product, durationUnit: 'WEEK' },
    { ...product, version: '' },
  ])('rejects invalid catalog data', (p) => {
    expect(() => parseProducts([p])).toThrow();
  });
  it('rejects duplicate codes', () =>
    expect(() => parseProducts([product, product])).toThrow());
});
