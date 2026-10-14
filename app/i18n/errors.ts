import { createUiText } from './text';
import sources from './messages/sources.json';
import type { Locale } from './config';
const messages: Record<string, string> = {
  INVALID_REQUEST: '입력 내용을 확인하고 다시 시도해 주세요.',
  FORBIDDEN: '이 기능을 이용할 권한이 없습니다.',
  USER_NOT_FOUND: '계정 정보를 찾을 수 없습니다. 다시 로그인해 주세요.',
  PAYMENT_HISTORY_NOT_FOUND: '결제 내역을 찾을 수 없습니다.',
  AUTH_SERVICE_UNAVAILABLE: '로그인 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',

  UNSUPPORTED_LOCALE: '지원하지 않는 언어입니다.',
  ENGLISH_NOT_ENABLED: '영어 템플릿을 준비하고 있습니다.',
  TEMPLATE_TRANSLATION_NOT_AVAILABLE: '선택한 언어로 제공되지 않는 템플릿입니다.',
  TEMPLATE_NOT_AVAILABLE: '아직 추가 예정인 템플릿입니다.',
  TEMPLATE_LOGIN_REQUIRED: '로그인 시 이용 가능한 기능입니다.',
  PAID_TEMPLATE_REQUIRED: '유료 템플릿은 결제 후 이용할 수 있습니다.',
  INVALID_TOKEN: '로그인이 만료되었습니다. 다시 로그인해 주세요.',
  MISSING_AUTH_TOKEN: '로그인이 만료되었습니다. 다시 로그인해 주세요.',
  TOKEN_EXPIRED: '로그인이 만료되었습니다. 다시 로그인해 주세요.',
  AUTH_ACCOUNT_CHANGED: '이전에 사용하던 계정으로 로그인해 주세요.',
  CONFLICT: '다른 작업에서 프로젝트가 변경되었습니다. 새로고침해 주세요.',
  COUPON_WADIZ_DISABLED: '현재 와디즈 쿠폰은 등록할 수 없습니다.',
  COUPON_GENERAL_DISABLED: '현재 일반 쿠폰은 등록할 수 없습니다.',
  COUPON_CODE_INVALID: '쿠폰 코드가 올바르지 않습니다.',
  COUPON_REFRESH_REQUIRED: '쿠폰 등록 화면이 변경되었습니다. 새로고침 후 다시 시도해 주세요.',
  COUPON_INVALID: '닉네임 또는 쿠폰 코드가 올바르지 않습니다.',
  COUPON_USED: '이미 사용된 쿠폰 코드입니다.',
  COUPON_EXPIRED: '쿠폰 등록 기간이 만료되었습니다.',
};
export function publicErrorMessage(payload: { errorCode?: string; message?: string } | null | undefined, locale: Locale) {
  const knownMessage = payload?.message && Object.hasOwn(sources, payload.message.replace(/\s+/g, ' ').trim()) ? payload.message : undefined;
  const source = messages[payload?.errorCode ?? ''] || knownMessage || '요청을 처리하지 못했습니다. 다시 시도해 주세요.';
  return createUiText(locale)(source);
}
