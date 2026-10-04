import { useEffect, useRef, type FormEvent } from 'react';
import type { CouponType } from '@/app/lib/coupons/types';
import { COUPON_EXTENSION_NOTICE, COUPON_REFUND_NOTICE } from '@/app/lib/coupons/display';

export const couponActionClass = 'w-full rounded-xl bg-gradient-to-r from-[#EB48B1] to-[#F59A39] px-5 py-3 font-semibold text-white disabled:opacity-50';
export type CouponErrors = { nickname?: string; code?: string };

export default function CouponRegistrationForm({ type, nickname, code, setNickname, setCode, errors, failure, enabled, pending, onSubmit }: {
  type: CouponType; nickname: string; code: string;
  setNickname: (value: string) => void; setCode: (value: string) => void;
  errors: CouponErrors; failure: string | null; enabled: boolean; pending: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const failureMessage = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (failure) failureMessage.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }, [failure]);

  const actionClass = couponActionClass;
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5" aria-busy={pending}>
      <p id="coupon-description" className="text-sm leading-6 text-gray-600">
        {type === 'WADIZ' ? <>와디즈 펀딩 시 사용한 <strong>닉네임과 릴스탬프 쿠폰 코드</strong>를 입력해 주세요.</> : '전달받은 쿠폰 코드를 입력해 주세요.'}
      </p>
      {type === 'WADIZ' && <div>
        <label htmlFor="coupon-nickname" className="mb-2 block text-sm font-semibold">닉네임</label>
        <input id="coupon-nickname" value={nickname} onChange={(event) => setNickname(event.target.value)}
          placeholder="닉네임을 입력해 주세요" autoComplete="off" maxLength={200} disabled={pending || !enabled}
          aria-invalid={!!errors.nickname} aria-describedby={errors.nickname ? 'coupon-nickname-error' : undefined}
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100" />
        {errors.nickname && <p id="coupon-nickname-error" className="mt-1 text-sm text-red-600">{errors.nickname}</p>}
      </div>}
      <div>
        <label htmlFor="coupon-code" className="mb-2 block text-sm font-semibold">쿠폰 코드</label>
        <input id="coupon-code" value={code} onChange={(event) => setCode(event.target.value)}
          placeholder="RS-" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={100} disabled={pending || !enabled}
          aria-invalid={!!errors.code} aria-describedby={errors.code ? 'coupon-code-error' : undefined}
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100" />
        {errors.code && <p id="coupon-code-error" className="mt-1 text-sm text-red-600">{errors.code}</p>}
      </div>
      <div className="space-y-2 rounded-xl bg-gray-50 p-3 text-xs leading-5 text-gray-500">
        {type === 'WADIZ' && <p>2026년 12월 31일까지 등록할 수 있습니다. (한국 시간)</p>}
        <p>{COUPON_EXTENSION_NOTICE}</p>
        <p>{COUPON_REFUND_NOTICE}</p>
      </div>
      {failure && <p ref={failureMessage} role="alert" aria-atomic="true" className="text-sm leading-6 text-red-600">
        {failure}
      </p>}
      <button type="submit" disabled={pending || !enabled} className={actionClass}>{pending ? '등록 중...' : '쿠폰 등록하기'}</button>
    </form>
  );
}
