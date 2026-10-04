'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { CouponApiError, getCouponAvailability, redeemCoupon } from '@/app/lib/coupons/client';
import CouponRegistrationForm, { type CouponErrors } from './CouponRegistrationForm';
import CouponResultContent from './CouponResultContent';
import CouponTabs from './CouponTabs';
import { isCouponEnabled } from '@/app/lib/coupons/availability';
import type { CouponAvailability, CouponResult, CouponType } from '@/app/lib/coupons/types';

export default function CouponDialog({ availability, onAvailabilityChange, onClose, onRegistered }: {
  availability: CouponAvailability;
  onAvailabilityChange: (availability: CouponAvailability) => void;
  onClose: () => void;
  onRegistered: (result: CouponResult) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const [type, setType] = useState<CouponType>(availability.wadizEnabled ? 'WADIZ' : 'GENERAL');
  const [drafts, setDrafts] = useState({ WADIZ: { nickname: '', code: '' }, GENERAL: { nickname: '', code: '' } });
  const draft = drafts[type];
  const enabled = isCouponEnabled(availability, type);
  const [errors, setErrors] = useState<CouponErrors>({});
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [result, setResult] = useState<CouponResult | null>(null);

  function updateDraft(patch: Partial<typeof draft>) {
    setDrafts((previous) => ({ ...previous, [type]: { ...previous[type], ...patch } }));
    setFailure(null);
    setErrors((previous) => ({
      nickname: patch.nickname === undefined ? previous.nickname : undefined,
      code: patch.code === undefined ? previous.code : undefined,
    }));
  }

  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    element?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    if (result) heading.current?.focus();
    else dialog.current?.querySelector<HTMLInputElement>('input')?.focus();
  }, [result]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !enabled) return;
    setFailure(null);
    const nextErrors = {
      nickname: type === 'GENERAL' || draft.nickname.trim() ? undefined : '닉네임을 입력해 주세요.',
      code: draft.code.trim() ? undefined : '쿠폰 코드를 입력해 주세요.',
    };
    setErrors(nextErrors);
    if (nextErrors.nickname || nextErrors.code) {
      dialog.current?.querySelector<HTMLInputElement>(nextErrors.nickname ? '#coupon-nickname' : '#coupon-code')?.focus();
      return;
    }
    submitting.current = true;
    setPending(true);
    try {
      const registered = await redeemCoupon(type === 'WADIZ' ? { couponType: type, ...draft } : { couponType: type, code: draft.code });
      setResult(registered);
      onRegistered(registered);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : '쿠폰을 등록하지 못했습니다. 다시 시도해 주세요.');
      if (error instanceof CouponApiError && ['COUPON_WADIZ_DISABLED', 'COUPON_GENERAL_DISABLED'].includes(error.errorCode || '')) {
        // Immediately disable the rejected type, even if the follow-up status request fails.
        onAvailabilityChange({ ...availability, [type === 'WADIZ' ? 'wadizEnabled' : 'generalEnabled']: false });
        await getCouponAvailability().then(onAvailabilityChange).catch(() => undefined);
      }
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="coupon-title"
      aria-describedby="coupon-description"
      onCancel={(event) => { event.preventDefault(); if (!submitting.current) onClose(); }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled])',
        )).filter((element) => element.tabIndex >= 0);
        const current = controls.indexOf(document.activeElement as HTMLElement);
        if (!controls.length || (event.shiftKey ? current <= 0 : current === controls.length - 1)) {
          event.preventDefault();
          (event.shiftKey ? controls.at(-1) : controls[0])?.focus();
        }
      }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border-0 bg-white p-6 text-gray-900 shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm sm:p-8"
    >
      <button type="button" onClick={onClose} disabled={pending} aria-label="닫기"
        className="absolute right-3 top-3 rounded-full p-2 text-gray-400 hover:bg-gray-100 disabled:opacity-50">
        <X className="h-5 w-5" />
      </button>
      <h2 id="coupon-title" ref={heading} tabIndex={-1} className="mb-4 pr-6 text-2xl font-bold outline-none">
        {result ? '쿠폰 등록 완료 🎉' : '쿠폰 등록'}
      </h2>
      {!result && <CouponTabs value={type} availability={availability} disabled={pending} onChange={(next) => {
        if (submitting.current || !isCouponEnabled(availability, next)) return;
        setType(next); setErrors({}); setFailure(null);
      }} />}
      <div role={result ? undefined : 'tabpanel'} id="coupon-panel" aria-labelledby={result ? undefined : `coupon-tab-${type}`}>
        {result ? (
          <CouponResultContent result={result} onClose={onClose} />
        ) : (
          <CouponRegistrationForm type={type} nickname={draft.nickname} code={draft.code}
            setNickname={(nickname) => updateDraft({ nickname })} setCode={(code) => updateDraft({ code })}
            errors={errors} failure={failure} enabled={enabled} pending={pending} onSubmit={submit} />
        )}
      </div>
    </dialog>
  );
}
