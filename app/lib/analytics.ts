import { GA_MEASUREMENT_ID } from './analytics-config';

type EventParams = Record<string, string | number | boolean | undefined>;
type TemplateParams = { template_id: string };
type ReelsEvents = {
  template_start: TemplateParams & { template_name: string };
  direct_camera: TemplateParams;
  media_upload: TemplateParams & { media_type: 'image' | 'video' };
  edit_start: TemplateParams;
  edit_complete: TemplateParams;
  download_click: TemplateParams;
  instagram_share_click: TemplateParams;
};

export const trackReelsEvent = <Name extends keyof ReelsEvents>(
  name: Name,
  params: ReelsEvents[Name],
) => {
  if (!params.template_id) return;
  trackEvent(name, params);
};

// Google Analytics 4 이벤트 추적
export const trackEvent = (
  eventName: string,
  eventParams?: EventParams
) => {
  try {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', eventName, { ...eventParams, send_to: GA_MEASUREMENT_ID });
    }
  } catch { /* Analytics must never interrupt editing, downloads or navigation. */ }
};

// 페이지뷰 추적 (자동으로 처리되지만 필요시 수동 호출 가능)
export const trackPageView = (url: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', GA_MEASUREMENT_ID, {
      page_path: url,
    });
  }
};

// 전환 추적
export const trackConversion = (conversionId: string, value?: number) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'conversion', {
      send_to: conversionId,
      value: value,
      currency: 'KRW',
    });
  }
};

// 사용자 속성 설정
export const setUserProperty = (propertyName: string, value: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('set', 'user_properties', {
      [propertyName]: value,
    });
  }
};

// 타입 정의
declare global {
  interface Window {
    gtag?: (
      command: 'config' | 'event' | 'set',
      targetId: string | Record<string, unknown>,
      config?: Record<string, unknown>
    ) => void;
  }
}
