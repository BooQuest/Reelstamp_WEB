import type { Locale } from '@/app/i18n/config';
export interface PassProduct {
  plan: string;
  name: string;
  description?: string | null;
  locale?: Locale;
  regularPrice: number | null;
  salePrice: number;
  durationValue: number;
  durationUnit: 'DAY' | 'MONTH' | 'YEAR';
  displayOrder: number;
  version: string;
}
export interface PassOrder {
  orderId: string;
  productName: string;
  displayProductName?: string;
  displayLocale?: Locale;
  price: number;
  durationValue: number;
  durationUnit: PassProduct['durationUnit'];
  status: string;
  createdAt: string;
  paidAt: string | null;
  payUrl: string | null;
}
export function durationLabel(
  product: Pick<PassProduct, 'durationValue' | 'durationUnit'>,
  locale: Locale = 'ko',
) {
  if (locale === 'en') {
    const unit = { DAY: 'day', MONTH: 'month', YEAR: 'year' }[product.durationUnit];
    return `${product.durationValue} ${unit}${product.durationValue === 1 ? '' : 's'}`;
  }
  return `${product.durationValue}${{ DAY: '일', MONTH: '개월', YEAR: '년' }[product.durationUnit]}`;
}
export function parseProducts(value: unknown, locale: Locale = 'ko'): PassProduct[] {
  if (!Array.isArray(value)) throw new Error('Invalid catalog');
  const codes = new Set<string>();
  for (const item of value) {
    if (
      !item ||
      !['PASS_7D', 'PASS_1M', 'PASS_3M', 'PASS_1Y'].includes(item.plan) ||
      codes.has(item.plan) ||
      typeof item.name !== 'string' ||
      !item.name.trim() ||
      !Number.isSafeInteger(item.salePrice) ||
      item.salePrice <= 0 ||
      !Number.isSafeInteger(item.durationValue) ||
      item.durationValue <= 0 ||
      !['DAY', 'MONTH', 'YEAR'].includes(item.durationUnit) ||
      !Number.isInteger(item.displayOrder) ||
      typeof item.version !== 'string' ||
      !item.version
    )
      throw new Error('Invalid catalog');
    codes.add(item.plan);
  }
  return value
    .map(
      ({
        plan,
        name,
        description,
        price,
        salePrice,
        durationValue,
        durationUnit,
        displayOrder,
        version,
      }) =>
        ({
          plan,
          name,
          description: typeof description === 'string' ? description : null,
          locale,
          regularPrice:
            Number.isSafeInteger(price?.regularPrice) && price.regularPrice > 0
              ? price.regularPrice
              : null,
          salePrice,
          durationValue,
          durationUnit,
          displayOrder,
          version,
        }) as PassProduct,
    )
    .sort((a, b) => a.displayOrder - b.displayOrder);
}
export const ORDER_STATUS: Record<string, string> = {
  CREATING: '결제 요청 확인 중',
  PENDING: '결제 확인 중',
  WAITING_DEPOSIT: '입금 대기',
  PAID: '결제 완료',
  FAILED: '결제 실패',
  CANCELED: '결제 취소',
  REFUNDED: '전액 환불',
  PARTIAL_REFUND: '부분 환불 · 확인 필요',
  REVIEW: '결제 확인 지연',
};
