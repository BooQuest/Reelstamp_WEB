'use client';

import { useUiText } from '@/app/i18n/LocaleProvider';
import Link from 'next/link';
import type { CouponResult } from '@/app/lib/coupons/types';
import { couponDate, couponDateTime, couponTime } from '@/app/lib/coupons/display';
import { couponTotalPeriod, wadizBenefit } from '@/app/lib/coupons/localised-display';
import { couponActionClass as actionClass } from './CouponRegistrationForm';

export default function CouponResultContent({ result, onClose }: { result: CouponResult; onClose: () => void }) {
  const t = useUiText();
  return (
    <div className="space-y-4">
      <div id="coupon-description" className="space-y-2 leading-relaxed">
        <p>{result.couponType === 'WADIZ' ? wadizBenefit(result, result.benefit, t) : t(result.productName)}</p>
        <p className="font-bold">{t.format('총 {period} 이용권이 지급되었습니다.', { period: couponTotalPeriod(result, t) })}</p>
        <p className="text-sm text-gray-600">{t.format('(유효기간: {date} 까지)', { date: couponDate(result.endsAt) })}</p>
        <p className="text-xs text-gray-500">{t.format('{time} 만료 (한국 시간)', { time: couponTime(result.endsAt) })}</p>
      </div>
      {result.extended && <div className="rounded-xl bg-pink-50 p-3 text-sm leading-6">
        <p>{t("기존 이용기간 뒤에 이어서 적용되었습니다.")}</p>
        <p>{t.format('적용 시작: {date}', { date: couponDateTime(result.startsAt, t) })}</p>
      </div>}
      <Link href="/plan" className="inline-block text-sm text-rose-600 underline">{t("이용권 정보 확인")}</Link>
      <button type="button" onClick={onClose} className={actionClass}>{t("확인")}</button>
    </div>
  );
}
