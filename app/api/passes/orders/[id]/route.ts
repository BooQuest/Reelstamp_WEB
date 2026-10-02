import { NextRequest, NextResponse } from 'next/server';
import { getServerApiClient } from '@/app/lib/api/server-client';
import { passApiError } from '@/app/lib/passes/payment-server';
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const api = await getServerApiClient();
    const { data } = await api.get(
      `/api/passes/orders/${encodeURIComponent(id)}`,
    );
    const { orderId, productName, price, status, createdAt, paidAt } =
      data.data;
    return NextResponse.json(
      { orderId, productName, price, status, createdAt, paidAt },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return passApiError(error);
  }
}
