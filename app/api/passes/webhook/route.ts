import { NextRequest, NextResponse } from 'next/server';
import {
  equalSecret,
  internalPassRequest,
} from '@/app/lib/passes/payment-server';
export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const text = (key: string) =>
      typeof form.get(key) === 'string' ? String(form.get(key)) : '';
    if (
      !equalSecret(text('userid'), process.env.PAYAPP_USERID) ||
      !equalSecret(text('linkkey'), process.env.PAYAPP_LINKKEY) ||
      !equalSecret(text('linkval'), process.env.PAYAPP_LINKVAL)
    )
      return new NextResponse('INVALID_AUTH', { status: 403 });
    const amount = Number(text('price')),
      payState = Number(text('pay_state'));
    if (
      !text('var2').startsWith('PASS-') ||
      !/^\d+$/.test(text('mul_no')) ||
      !/^\d+$/.test(text('price')) ||
      !/^\d+$/.test(text('pay_state')) ||
      !Number.isSafeInteger(amount) ||
      !Number.isSafeInteger(payState)
    )
      return new NextResponse('INVALID_PAYMENT', { status: 400 });
    const partial = payState === 70 || payState === 71;
    if (
      partial &&
      (!/^\d+$/.test(text('orig_mul_no')) ||
        !/^\d+$/.test(text('orig_price')) ||
        !Number.isSafeInteger(Number(text('orig_price'))) ||
        amount <= 0 ||
        amount > Number(text('orig_price')))
    )
      return new NextResponse('INVALID_ORIGINAL_PAYMENT', { status: 400 });
    const result = await internalPassRequest('events', {
      orderId: text('var2'),
      paymentNo: partial ? text('orig_mul_no') : text('mul_no'),
      sourcePaymentNo: text('mul_no'),
      payState,
      amount: partial ? Number(text('orig_price')) : amount,
      eventDate: text('canceldate') || text('pay_date'),
      cancelAmount: partial ? text('price') : text('cancelprice'),
    });
    return new NextResponse(result.data === 'SUCCESS' ? 'SUCCESS' : 'RETRY', {
      status: result.data === 'SUCCESS' ? 200 : 503,
    });
  } catch {
    return new NextResponse('RETRY', { status: 503 });
  }
}
