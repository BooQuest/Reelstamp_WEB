import 'server-only';

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
    return { status: 'ready', data: response.data.data.map(toPaymentRecord) };
  } catch {
    return { status: 'error' };
  }
}
