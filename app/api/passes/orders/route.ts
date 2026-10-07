import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/lib/api/auth';
import { getMutableServerApiClient } from '@/app/lib/api/server-client';
import { createPayAppPaymentLink } from '@/app/lib/api/payapp';
import {
  internalPassRequest,
  passApiError,
  sameOrigin,
} from '@/app/lib/passes/payment-server';
import type { PassOrder } from '@/app/lib/passes/catalog';

export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { message: '잘못된 요청입니다.' },
      { status: 403 },
    );
  try {
    const user = await getCurrentUser(true);
    if (!user || user.guest || user.provider === 'GUEST')
      return NextResponse.json(
        { message: '로그인이 필요합니다.' },
        { status: 401 },
      );
    const { code, version, phone, idempotencyKey } = await request.json();
    const userid = process.env.PAYAPP_USERID,
      linkkey = process.env.PAYAPP_LINKKEY;
    const base = process.env.NEXT_PUBLIC_BASE_URL;
    if (
      !userid ||
      !linkkey ||
      !process.env.PAYAPP_LINKVAL ||
      !process.env.X_INTERNAL_SECRET ||
      !base
    )
      return NextResponse.json(
        { message: '결제 설정을 확인 중입니다.' },
        { status: 503 },
      );
    const api = await getMutableServerApiClient();
    const { data } = await api.post('/api/passes/orders', {
      code,
      version,
      phone,
      idempotencyKey,
    });
    if (!data.success) throw new Error('Order unavailable');
    let order: PassOrder = data.data.order;
    if (data.data.dispatch) {
      try {
        const result = await createPayAppPaymentLink({
          userid,
          linkkey,
          goodname: order.productName,
          price: order.price,
          recvphone: phone,
          returnurl: `${base}/pricing/success?orderId=${encodeURIComponent(order.orderId)}`,
          feedbackurl: `${base}/api/passes/webhook`,
          var1: 'PASS',
          var2: order.orderId,
        });
        const attached = await internalPassRequest('link', {
          orderId: order.orderId,
          paymentNo: result.mul_no,
          payUrl: result.payurl,
          failed: result.state !== '1',
          uncertain: result.uncertain === true,
        });
        order = attached.data.data;
      } catch {
        // 불명확한 PG 요청은 새 주문/결제를 자동 생성하지 않습니다.
        try {
          await internalPassRequest('link', {
            orderId: order.orderId,
            failed: true,
            uncertain: true,
          });
        } catch {
          /* 이후 통보/재조회로 복구 */
        }
        return NextResponse.json({
          orderId: order.orderId,
          status: 'REVIEW',
          payUrl: null,
        });
      }
    }
    return NextResponse.json({
      orderId: order.orderId,
      status: order.status,
      payUrl: ['PENDING', 'WAITING_DEPOSIT'].includes(order.status)
        ? order.payUrl
        : null,
    });
  } catch (error) {
    return passApiError(error);
  }
}
