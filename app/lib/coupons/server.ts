import 'server-only';
import { NextResponse } from 'next/server';
import { getServerApiClient, getMutableServerApiClient } from '@/app/lib/api/server-client';
import { isCouponAvailability } from './availability';
import type { CouponAvailability, EntitlementSummary } from './types';

export async function getEntitlements(): Promise<EntitlementSummary> {
  const api = await getServerApiClient();
  const { data } = await api.get('/api/passes/entitlements');
  if (!data.success || !Array.isArray(data.data?.grants)) throw new Error('Entitlements unavailable');
  return data.data;
}

export async function getCouponAvailability(mutable = false): Promise<CouponAvailability> {
  const api = await (mutable ? getMutableServerApiClient() : getServerApiClient());
  const { data } = await api.get('/api/coupons/availability', { headers: { 'Cache-Control': 'no-cache' } });
  if (!data.success || !isCouponAvailability(data.data)) throw new Error('Coupon availability unavailable');
  return data.data;
}

export function couponApiError(error: unknown) {
  const response = (error as { response?: { status?: number; data?: { errorCode?: string } } })?.response;
  const messages: Record<string, string> = {
    AUTH_ACCOUNT_CHANGED: '이전에 사용하던 계정으로 로그인해 주세요.',
    COUPON_WADIZ_DISABLED: '현재 와디즈 쿠폰은 등록할 수 없습니다.',
    COUPON_GENERAL_DISABLED: '현재 일반 쿠폰은 등록할 수 없습니다.',
    COUPON_CODE_INVALID: '쿠폰 코드가 올바르지 않습니다.',
    COUPON_REFRESH_REQUIRED: '쿠폰 등록 화면이 변경되었습니다. 새로고침 후 다시 시도해 주세요.',
    COUPON_INVALID: '닉네임 또는 쿠폰 코드가 올바르지 않습니다.',
    COUPON_USED: '이미 사용된 쿠폰 코드입니다.',
    COUPON_EXPIRED: '쿠폰 등록 기간이 만료되었습니다.',
  };
  const code = response?.data?.errorCode;
  const status = response?.status;
  const message = status === 401
    ? '로그인이 만료되었습니다. 다시 로그인해 주세요.'
    : status === 403
      ? '정식 로그인 후 쿠폰을 등록해 주세요.'
      : code && messages[code]
        ? messages[code]
        : '등록 결과를 확인하지 못했습니다. 이용기간을 확인한 후 다시 시도해 주세요.';
  return NextResponse.json({ success: false, message, errorCode: code && messages[code] ? code : undefined }, {
    status: status && [400, 401, 403, 409].includes(status) ? status : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
