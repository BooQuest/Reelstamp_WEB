import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getMutableServerApiClient } from '@/app/lib/api/server-client';
import { sameOrigin } from '@/app/lib/passes/payment-server';
import { couponApiError } from './server';
import type { CouponType } from './types';

export async function proxyCouponRedemption(request: NextRequest, type: CouponType) {
  const reject = (message: string, status = 400) => NextResponse.json(
    { success: false, message }, { status, headers: { 'Cache-Control': 'no-store' } },
  );
  if (!sameOrigin(request)) return reject('허용되지 않은 요청입니다.', 403);
  const body = await request.json().catch(() => null);
  if (type === 'GENERAL' && body && Object.hasOwn(body, 'nickname')) {
    return reject('쿠폰 등록 화면이 변경되었습니다. 새로고침 후 다시 시도해 주세요.');
  }
  const wadiz = type === 'WADIZ';
  if (typeof body?.code !== 'string' || !body.code.trim() || body.code.length > 100 ||
      (wadiz && (typeof body?.nickname !== 'string' || !body.nickname.trim() || body.nickname.length > 200))) {
    return reject(wadiz ? '닉네임과 쿠폰 코드를 입력해 주세요.' : '쿠폰 코드를 입력해 주세요.');
  }
  try {
    const api = await getMutableServerApiClient();
    const payload = { ...(wadiz ? { nickname: body.nickname.trim() } : {}), code: body.code.trim().toUpperCase() };
    const { data } = await api.post(wadiz ? '/api/coupons/wadiz/redeem' : '/api/coupons/redeem', payload);
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return couponApiError(error);
  }
}
