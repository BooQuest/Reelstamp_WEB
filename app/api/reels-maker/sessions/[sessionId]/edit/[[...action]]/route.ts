import { NextRequest, NextResponse } from 'next/server';
import { getMutableServerApiClient } from '@/app/lib/api/server-client';

export async function POST(request: NextRequest,
  { params }: { params: Promise<{ sessionId: string; action?: string[] }> }) {
  const { sessionId, action = [] } = await params;
  if (!/^\d+$/.test(sessionId) || action.length > 1 || (action.length === 1 && !['save', 'discard'].includes(action[0])))
    return NextResponse.json({ success: false }, { status: 400 });
  try {
    const api = await getMutableServerApiClient();
    const response = await api.post(`/api/reels-maker/sessions/${sessionId}/edit${action.length ? `/${action[0]}` : ''}`, await request.json());
    return NextResponse.json(response.data, { status: response.status });
  } catch (error) {
    const response = (error as { response?: { status: number; data?: { message?: string; errorCode?: string } } }).response;
    return NextResponse.json({ success: false, message: response?.data?.message || '프로젝트 작업을 처리하지 못했습니다.',
      errorCode: response?.data?.errorCode }, { status: response?.status || 500 });
  }
}
