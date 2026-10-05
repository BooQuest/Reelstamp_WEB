import { NextRequest } from 'next/server';
import { proxyCouponRedemption } from '@/app/lib/coupons/redemption-server';

export async function POST(request: NextRequest) {
  return proxyCouponRedemption(request, 'WADIZ');
}
