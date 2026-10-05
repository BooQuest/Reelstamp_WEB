import { COUPON_AVAILABILITY_ERROR, isCouponAvailability } from './availability';
import type { CouponAvailability, CouponRequest, CouponResult } from './types';

export class CouponApiError extends Error {
  constructor(message: string, readonly errorCode?: string) { super(message); }
}

export async function getCouponAvailability(): Promise<CouponAvailability> {
  try {
    const response = await fetch('/api/coupons/availability', { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok || !body.success || !isCouponAvailability(body.data)) throw new Error();
    return body.data;
  } catch {
    throw new Error(COUPON_AVAILABILITY_ERROR);
  }
}

export async function redeemCoupon(request: CouponRequest): Promise<CouponResult> {
  let response: Response;
  try {
    response = await fetch(request.couponType === 'WADIZ' ? '/api/coupons/wadiz/redeem' : '/api/coupons/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(request.couponType === 'WADIZ' ? { nickname: request.nickname.trim() } : {}),
        code: request.code.trim().toUpperCase(),
      }),
    });
  } catch {
    throw new Error('통신 오류로 등록 결과를 확인하지 못했습니다. 이용기간을 확인한 후 다시 시도해 주세요.');
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    if (response.status === 401) throw new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.');
    throw new CouponApiError(body?.message || '등록 결과를 확인하지 못했습니다. 이용기간을 확인한 후 다시 시도해 주세요.', body?.errorCode);
  }
  return body.data;
}
