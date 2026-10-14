import { passReadLocale } from '@/app/lib/passes/locale';
import { NextRequest, NextResponse } from 'next/server';
import { getMutableServerApiClient } from '@/app/lib/api/server-client';
import { passApiError } from '@/app/lib/passes/payment-server';
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const locale = passReadLocale(request);
    const api = await getMutableServerApiClient();
    const { data } = await api.get(
      `/api/passes/orders/${encodeURIComponent(id)}?locale=${locale}`,
    );
    const { orderId, productName, displayProductName, displayLocale, price, status, createdAt, paidAt } =
      data.data;
    return NextResponse.json(
      { orderId, productName, displayProductName, displayLocale, price, status, createdAt, paidAt },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return passApiError(error);
  }
}
