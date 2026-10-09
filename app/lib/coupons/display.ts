export const COUPON_EXTENSION_NOTICE =
  '이용기간이 남아 있으면 기존 이용기간 종료 후 이어서 적용됩니다.';

export function couponDate(value: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(value));
}

export function couponTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).format(new Date(value));
}

export function couponDateTime(value: string) {
  return `${couponDate(value)} ${couponTime(value)} (한국 시간)`;
}
