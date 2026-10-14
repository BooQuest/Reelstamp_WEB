import type { UiText } from '@/app/i18n/text';
import { durationLabel } from '@/app/lib/passes/catalog';
import type { CouponResult, EntitlementGrant, WadizReward } from './types';

const benefits: Record<WadizReward, string> = {
  PASS_7D: '1주일 이용권 + 1개월 추가 혜택',
  PASS_1M: '1개월 이용권 + 1개월 추가 혜택',
  PASS_3M: '3개월 이용권 + 1개월 추가 혜택',
  PASS_1Y: '1년 이용권 + 3개월 추가 혜택',
};

type CouponDisplay = Pick<EntitlementGrant, 'reward' | 'durationValue' | 'durationUnit'>;

export function wadizDuration(source: CouponDisplay, t: UiText): string {
  if (source.durationUnit !== 'MONTH' || source.durationValue < 12) return durationLabel(source, t.locale);
  const years = durationLabel({ durationValue: Math.floor(source.durationValue / 12), durationUnit: 'YEAR' }, t.locale);
  const remainder = source.durationValue % 12;
  return remainder ? t.format('{years} {months}', {
    years, months: durationLabel({ durationValue: remainder, durationUnit: 'MONTH' }, t.locale),
  }) : years;
}

export function wadizBenefit(source: CouponDisplay, original: string, t: UiText): string {
  if (t.locale === 'ko') return original;
  const key = source.reward;
  if (key && Object.hasOwn(benefits, key)) return t(benefits[key as WadizReward]);
  // Older responses can omit reward while retaining the exact recorded benefit.
  // Translate only known wording; never infer bonus benefits from total duration.
  const recordedBenefit = original.trim();
  if (Object.values(benefits).includes(recordedBenefit)) return t(recordedBenefit);
  return `${t('와디즈 쿠폰 이용권')} · ${wadizDuration(source, t)}`;
}

export function couponTotalPeriod(result: CouponResult, t: UiText): string {
  if (t.locale === 'ko') return result.totalLabel;
  return result.couponType === 'WADIZ' ? wadizDuration(result, t) : durationLabel(result, t.locale);
}
