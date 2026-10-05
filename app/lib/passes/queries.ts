import 'server-only';

import type { PassOrder } from './catalog';
import { getServerApiClient } from '@/app/lib/api/server-client';
import { toPaymentRecord, type PaymentRecord, type QueryState } from './display';

// 로그인 확인을 마친 서버 페이지에서 기존 본인 조회 API만 호출합니다.
export async function getPaymentHistory(): Promise<QueryState<PaymentRecord[]>> {
  try {
    const api = await getServerApiClient();
    const response = await api.get<{ success: boolean; data: unknown }>(
      '/api/subscription/payments',
    );
    if (!response.data.success || !Array.isArray(response.data.data)) return { status: 'error' };
    const orders = await api.get<{ success: boolean; data: PassOrder[] }>('/api/passes/orders');
    if (!orders.data.success || !Array.isArray(orders.data.data)) return { status: 'error' };
    const modern: PaymentRecord[] = orders.data.data.map(order => ({
      id: order.orderId, orderId: order.orderId, name: order.productName, amount: order.price,
      paidAt: order.paidAt, status: ({ PAID: 'paid', REFUNDED: 'refunded', PARTIAL_REFUND: 'partial_refund',
        CANCELED: 'canceled', FAILED: 'failed', WAITING_DEPOSIT: 'waiting_deposit', REVIEW: 'unknown',
        CREATING: 'pending', PENDING: 'pending' } as Record<string, PaymentRecord['status']>)[order.status] || 'unknown',
    }));
    return { status: 'ready', data: [...modern, ...response.data.data.map(toPaymentRecord)]
      .sort((a, b) => (b.paidAt || '').localeCompare(a.paidAt || '')) };
  } catch {
    return { status: 'error' };
  }
}
