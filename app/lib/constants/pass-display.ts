// 화면 표시 전용입니다. 기존 결제용 플랜/DB 상품 정의와 연결하지 않습니다.
export const PASS_DISPLAY_PRODUCTS = [
  { code: 'PASS_7D', name: '1주일 체험권', durationLabel: '7일', price: 4900 },
  { code: 'PASS_1M', name: '1개월 이용권', durationLabel: '1개월', price: 9900 },
  { code: 'PASS_3M', name: '3개월 이용권', durationLabel: '3개월', price: 27900 },
  { code: 'PASS_1Y', name: '1년 이용권', durationLabel: '1년', price: 99000 },
] as const;

export const PASS_DISPLAY_FEATURES = [
  '템플릿 기반 영상 제작',
  '자막 생성·편집',
  '완성 영상 다운로드',
] as const;
