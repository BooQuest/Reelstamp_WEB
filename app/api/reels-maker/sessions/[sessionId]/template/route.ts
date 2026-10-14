import { NextResponse } from 'next/server';
import { getMutableServerApiClient } from '@/app/lib/api/server-client';
export async function GET(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params;
    const api = await getMutableServerApiClient();
    const response = await api.get(`/api/reels-maker/sessions/${encodeURIComponent(sessionId)}/template`);
    return NextResponse.json(response.data, { status: response.status, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error: unknown) {
    const response = (error as { response?: { status?: number; data?: { errorCode?: string } } }).response;
    return NextResponse.json({ success: false, errorCode: response?.data?.errorCode ?? 'TEMPLATE_DETAIL_ERROR', data: null }, { status: response?.status ?? 500 });
  }
}
