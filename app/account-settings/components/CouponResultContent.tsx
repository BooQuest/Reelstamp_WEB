'use client';

import { useUiText } from '@/app/i18n/LocaleProvider';
import Link from 'next/link';
import type { CouponResult } from '@/app/lib/coupons/types';
import { couponDate, couponDateTime, couponTime } from '@/app/lib/coupons/display';
import { couponActionClass as actionClass } from './CouponRegistrationForm';

export default function CouponResultContent({ result, onClose }: { result: CouponResult; onClose: () => void }) {
  const t = useUiText();
  return (
    <div className="space-y-4">
      <div id="coupon-description" className="space-y-2 leading-relaxed">
        <p>{t(result.couponType === 'WADIZ' ? result.benefit : result.productName)}</p>
        <p className="font-bold">{t("총 ")}{t(result.totalLabel)} {t(" 이용권이 지급되었습니다.")}</p>
        <p className="text-sm text-gray-600">{t("(유효기간: ")}{t(couponDate(result.endsAt))} {t(" 까지)")}</p>
        <p className="text-xs text-gray-500">{t(couponTime(result.endsAt))} {t(" 만료 (한국 시간)")}</p>
      </div>
      {result.extended && <div className="rounded-xl bg-pink-50 p-3 text-sm leading-6">
        <p>{t("기존 이용기간 뒤에 이어서 적용되었습니다.")}</p>
        <p>{t("적용 시작: ")}{t(couponDateTime(result.startsAt))}</p>
      </div>}
      <Link href="/plan" className="inline-block text-sm text-rose-600 underline">{t("이용권 정보 확인")}</Link>
      <button type="button" onClick={onClose} className={actionClass}>{t("확인")}</button>
    </div>
  );
}
