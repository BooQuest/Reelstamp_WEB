// API 관련 상수 정의: 외부 API 서버 엔드포인트 및 설정
export const API_CONFIG = {
  // Web API 서버 - 8082 포트
  WEB_BASE_URL: process.env.NEXT_PUBLIC_WEB_API_BASE_URL || 'http://140.245.70.80:8082',
  // 공통 설정
  TIMEOUT: parseInt(process.env.API_TIMEOUT || '300000', 10), // 5분 (300초)
} as const;
