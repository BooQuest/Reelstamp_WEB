import Link from 'next/link';
import type { CouponResult } from '@/app/lib/coupons/types';
import { COUPON_REFUND_NOTICE, couponDate, couponDateTime, couponTime } from '@/app/lib/coupons/display';
import { couponActionClass as actionClass } from './CouponRegistrationForm';

export default function CouponResultContent({ result, onClose }: { result: CouponResult; onClose: () => void }) {
  return (
    <div className="space-y-4">
      <div id="coupon-description" className="space-y-2 leading-relaxed">
        <p>{result.couponType === 'WADIZ' ? result.benefit : result.productName}</p>
        <p className="font-bold">총 {result.totalLabel} 이용권이 지급되었습니다.</p>
        <p className="text-sm text-gray-600">(유효기간: {couponDate(result.endsAt)} 까지)</p>
        <p className="text-xs text-gray-500">{couponTime(result.endsAt)} 만료 (한국 시간)</p>
      </div>
      {result.extended && <div className="rounded-xl bg-pink-50 p-3 text-sm leading-6">
        <p>기존 이용기간 뒤에 이어서 적용되었습니다.</p>
        <p>적용 시작: {couponDateTime(result.startsAt)}</p>
      </div>}
      <p className="text-xs leading-5 text-gray-500">{COUPON_REFUND_NOTICE}</p>
      <Link href="/plan" className="inline-block text-sm text-rose-600 underline">이용권 정보 확인</Link>
      <button type="button" onClick={onClose} className={actionClass}>확인</button>
    </div>
  );
}
