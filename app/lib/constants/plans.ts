export const PRICING_LOCKED_FOR_BETA = true;

export const PRICING_BETA_NOTICE = {
  title: '현재는 베타 무료 이용 기간입니다',
  description:
    '릴스탬프는 2026년 9월 6일 정식 출시 예정입니다. 정식 요금제는 출시일에 공개됩니다.',
  supportingText: '베타 기간 동안은 로그인 후 모든 템플릿을 무료로 이용하실 수 있습니다.',
  lockedMessage: '정식 요금제는 2026년 9월 6일 공개됩니다.',
} as const;

// 플랜 기능 리스트 상수
export const freePlanFeatures = [
  '제한적 편집 기능',
  '제한적 영상 생성',
  '제한적 메모리',
];

export const basicPlanFeatures = [
  '릴스 시나리오 무제한 생성',
  '대화형 수정 기능 무제한 사용',
  '제한적 메모리 및 텍스트 저장',
];

export const proPlanFeatures = [
  '릴스 시나리오 무제한 생성',
  '수정 기능 무제한 사용',
  {
    main: '영상 분석 월 20회',
    subItems: [
      '내 영상을 초 단위로 분석',
      '영상 흐름, 장면에 맞춰 시나리오 자동 최적화',
    ],
  },
  '영상 타임라인 수정 기능 무제한 사용',
];

export const masterPlanFeatures = [
  '릴스 시나리오 무제한 생성',
  '수정 기능 무제한 사용',
  {
    main: '영상 분석 무제한',
    subItems: [
      '내 영상을 초 단위로 분석',
      '영상 흐름에 맞춰 시나리오 자동 최적화',
    ],
  },
  '영상 타임라인 수정 기능 무제한 사용',
  '영상 입력 무제한',
];

// 오픈 이벤트 혜택 데이터
export const freePlanEventBenefit = {
  title: '오픈 이벤트 혜택',
  mainItem: '베타 버전 무료 이용'
};

export const basicPlanEventBenefit = {
  title: '오픈 이벤트 혜택',
  mainItem: '영상 분석 10회 제공',
  subItems: [
    '내 영상을 초 단위로 분석',
    '영상 흐름에 맞춰 시나리오 자동 최적화',
  ],
};
