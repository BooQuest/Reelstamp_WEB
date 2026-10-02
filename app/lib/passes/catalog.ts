export interface PassProduct {
  plan: string;
  name: string;
  salePrice: number;
  durationValue: number;
  durationUnit: 'DAY' | 'MONTH' | 'YEAR';
  displayOrder: number;
  version: string;
}
export interface PassOrder {
  orderId: string;
  productName: string;
  price: number;
  durationValue: number;
  durationUnit: PassProduct['durationUnit'];
  status: string;
  createdAt: string;
  paidAt: string | null;
  payUrl: string | null;
}
export interface PassGrant {
  orderId: string;
  productName: string;
  startsAt: string;
  endsAt: string;
  revokedAt: string | null;
}
export function durationLabel(
  product: Pick<PassProduct, 'durationValue' | 'durationUnit'>,
) {
  return `${product.durationValue}${{ DAY: '일', MONTH: '개월', YEAR: '년' }[product.durationUnit]}`;
}
export function parseProducts(value: unknown): PassProduct[] {
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
        salePrice,
        durationValue,
        durationUnit,
        displayOrder,
        version,
      }) =>
        ({
          plan,
          name,
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
