import 'server-only';
import { type NextRequest } from 'next/server';
import { englishEnabled, isLocale } from './config';
export async function templateLocale(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get('locale') ?? 'ko';
  if (!isLocale(locale)) throw Object.assign(new Error('Unsupported locale'), { response: { status: 400, data: { errorCode: 'UNSUPPORTED_LOCALE' } } });
  if (locale === 'en' && !englishEnabled()) throw Object.assign(new Error('English is not enabled'), { response: { status: 404, data: { errorCode: 'ENGLISH_NOT_ENABLED' } } });
  return locale;
}
export function requireCreationLocale(value: unknown) {
  const locale = value ?? 'ko';
  if (!isLocale(locale)) throw Object.assign(new Error('Unsupported locale'), { response: { status: 400, data: { errorCode: 'UNSUPPORTED_LOCALE' } } });
  if (locale === 'en' && !englishEnabled()) throw Object.assign(new Error('English is not enabled'), { response: { status: 404, data: { errorCode: 'ENGLISH_NOT_ENABLED' } } });
  return locale;
}
