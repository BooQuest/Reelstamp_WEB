import 'server-only';
import { NextResponse } from 'next/server';
import { getUiLocale } from './server';
import { publicErrorMessage } from './errors';
export async function localisedApiError(error: unknown, fallback: string, fallbackCode: string) {
  const failure = error as { response?: { status?: number; data?: { errorCode?: string; message?: string } } } | null;
  const status = failure?.response?.status || 500;
  const errorCode = failure?.response?.data?.errorCode || fallbackCode;
  const message = publicErrorMessage({ errorCode, message: failure?.response?.data?.message || fallback }, await getUiLocale());
  return NextResponse.json({ success: false, status, message, errorCode, data: null }, { status });
}
