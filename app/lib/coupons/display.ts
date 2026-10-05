export const COUPON_EXTENSION_NOTICE =
  '이용기간이 남아 있으면 기존 이용기간 종료 후 이어서 적용됩니다.';
export const COUPON_REFUND_NOTICE =
  '앞선 구매 이용권이 전액 환불되면 아직 시작하지 않은 이용권의 시작일과 종료일이 앞당겨질 수 있습니다. 변경된 일정은 이용권 정보에서 확인할 수 있습니다.';

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
