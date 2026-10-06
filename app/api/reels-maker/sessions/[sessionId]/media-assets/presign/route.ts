import { NextRequest, NextResponse } from 'next/server';
import { getMutableServerApiClient } from '@/app/lib/api/server-client';
export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string; clipId?: string; id?: string }> }) {
  const values = await params;
  const { sessionId, clipId, id } = values;
  void clipId; void id;
  if (Object.values(values).some(v => !v || !/^[a-zA-Z0-9-]+$/.test(v))) return NextResponse.json({ success: false }, { status: 400 });
  try {
    const client = await getMutableServerApiClient();
    const text = await request.text();
    const response = await client.post(`/api/reels-maker/sessions/${sessionId}/media-assets/presign`, text ? JSON.parse(text) : undefined);
    return NextResponse.json(response.data, { status: response.status });
  } catch (error) {
    const response = (error as { response?: { status: number; data?: { message?: string; errorCode?: string } } }).response;
    return NextResponse.json({ success: false, message: response?.data?.message || '편집 저장에 실패했습니다.', errorCode: response?.data?.errorCode }, { status: response?.status || 500 });
  }
}
