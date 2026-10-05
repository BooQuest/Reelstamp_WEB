import type { CouponAvailability, CouponType } from './types';

export const COUPON_AVAILABILITY_ERROR = '쿠폰 등록 가능 여부를 불러오지 못했습니다.';

export function isCouponEnabled(availability: CouponAvailability, type: CouponType) {
  return type === 'WADIZ' ? availability.wadizEnabled : availability.generalEnabled;
}

export function isCouponAvailability(value: unknown): value is CouponAvailability {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<CouponAvailability>;
  return typeof data.wadizEnabled === 'boolean' && typeof data.generalEnabled === 'boolean'
    && (data.message === null || typeof data.message === 'string');
}
