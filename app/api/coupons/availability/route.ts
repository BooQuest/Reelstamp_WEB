import { NextResponse } from 'next/server';
import { getCouponAvailability } from '@/app/lib/coupons/server';
import { COUPON_AVAILABILITY_ERROR } from '@/app/lib/coupons/availability';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ success: true, data: await getCouponAvailability(true) }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ success: false, message: COUPON_AVAILABILITY_ERROR }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
