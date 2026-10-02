import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import axios from 'axios';
import { API_CONFIG } from '@/app/lib/constants/api';
export function equalSecret(
  actual: string | null | undefined,
  expected: string | undefined,
) {
  if (!actual || !expected) return false;
  const a = Buffer.from(actual),
    b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function isInternalRequest(request: Request) {
  return equalSecret(
    request.headers.get('X-Internal-Secret'),
    process.env.X_INTERNAL_SECRET,
  );
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return (
    !!origin &&
    origin === new URL(process.env.NEXT_PUBLIC_BASE_URL || request.url).origin
  );
}
export async function internalPassRequest(path: string, body: unknown) {
  const secret = process.env.X_INTERNAL_SECRET;
  if (!secret) throw new Error('Internal secret missing');
  return axios.post(
    `${API_CONFIG.WEB_BASE_URL}/api/billing/passes/${path}`,
    body,
    {
      headers: { 'X-Internal-Secret': secret },
      timeout: 15000,
    },
  );
}
export function passApiError(error: unknown) {
  const status = axios.isAxiosError(error)
    ? (error.response?.status ?? 503)
    : 503;
  const message =
    axios.isAxiosError(error) &&
    typeof error.response?.data?.message === 'string'
      ? error.response.data.message
      : '요청을 확인할 수 없습니다. 잠시 후 다시 확인해 주세요.';
  return NextResponse.json({ success: false, message }, { status });
}
