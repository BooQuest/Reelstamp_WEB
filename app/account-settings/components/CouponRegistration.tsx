'use client';

import { useRef, useState } from 'react';
import { Ticket } from 'lucide-react';
import CouponDialog from './CouponDialog';
import { getCouponAvailability } from '@/app/lib/coupons/client';
import { COUPON_AVAILABILITY_ERROR } from '@/app/lib/coupons/availability';
import type { CouponAvailability, CouponResult } from '@/app/lib/coupons/types';

export default function CouponRegistration({ initialAvailability, isGuest, onLogin, onRegistered }: {
  initialAvailability: CouponAvailability | null;
  isGuest: boolean; onLogin: () => void; onRegistered: (result: CouponResult) => void;
}) {
  const [override, setOverride] = useState<{ initial: CouponAvailability | null; value: CouponAvailability | null } | null>(null);
  const availability = override?.initial === initialAvailability ? override.value : initialAvailability;
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const checkingRef = useRef(false);
  const enabled = Boolean(availability && (availability.wadizEnabled || availability.generalEnabled));

  function updateAvailability(value: CouponAvailability) {
    setOverride({ initial: initialAvailability, value });
  }

  async function openRegistration() {
    if (checkingRef.current) return;
    checkingRef.current = true; setChecking(true);
    try {
      const value = await getCouponAvailability();
      updateAvailability(value);
      if (value.wadizEnabled || value.generalEnabled) setOpen(true);
    } catch {
      setOverride({ initial: initialAvailability, value: null });
    } finally {
      checkingRef.current = false; setChecking(false);
    }
  }

  return <>
    <button type="button" disabled={!enabled || checking}
      onClick={() => isGuest ? onLogin() : void openRegistration()}
      aria-describedby={!enabled ? 'coupon-availability-notice' : undefined}
      className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 hover:bg-gray-50 transition-all disabled:cursor-not-allowed disabled:opacity-50">
      <Ticket className="w-5 h-5 text-gray-700" />
      <span className="font-semibold text-gray-900">{checking ? '확인 중...' : '쿠폰 등록'}</span>
    </button>
    {!enabled && <p id="coupon-availability-notice" role={availability ? undefined : 'status'} className="px-2 text-xs leading-5 text-gray-500">
      {availability ? availability.message || '현재 쿠폰 등록을 이용할 수 없습니다.' : COUPON_AVAILABILITY_ERROR}
    </p>}
    {enabled && isGuest && <p className="px-2 text-xs text-gray-500">정식 로그인 후 쿠폰을 등록할 수 있습니다.</p>}
    {open && availability && <CouponDialog availability={availability} onAvailabilityChange={updateAvailability}
      onClose={() => setOpen(false)} onRegistered={onRegistered} />}
  </>;
}
