import 'server-only';
import type { NextRequest } from 'next/server';
import { englishEnabled, isLocale } from '@/app/i18n/config';
import { AuthRequestError } from '@/app/lib/auth/server-errors';

function parse(value: unknown) {
  const locale = value ?? 'ko';
  if (!isLocale(locale)) throw new AuthRequestError(400, 'UNSUPPORTED_LOCALE', '지원하지 않는 언어입니다.');
  return locale;
}

// Existing purchases remain readable even if English sales are disabled.
export function passReadLocale(request: NextRequest) {
  return parse(request.nextUrl.searchParams.get('locale'));
}

export function passPurchaseLocale(value: unknown) {
  const locale = parse(value);
  if (locale === 'en' && !englishEnabled()) {
    throw new AuthRequestError(404, 'ENGLISH_NOT_ENABLED', '영어 서비스가 아직 공개되지 않았습니다.');
  }
  return locale;
}
