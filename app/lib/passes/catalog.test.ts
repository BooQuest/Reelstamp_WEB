import { describe, expect, it } from 'vitest';
import { durationLabel, parseProducts } from './catalog';
const product = {
  plan: 'PASS_7D',
  name: 'DB에서 바꾼 이름',
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
    expect(durationLabel(parsed)).toBe('8일');
    expect(durationLabel({ durationValue: 1, durationUnit: 'MONTH' })).toBe(
      '1개월',
    );
    expect(durationLabel({ durationValue: 1, durationUnit: 'YEAR' })).toBe(
      '1년',
    );
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
