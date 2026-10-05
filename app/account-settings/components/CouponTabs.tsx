import { isCouponEnabled } from '@/app/lib/coupons/availability';
import type { CouponAvailability, CouponType } from '@/app/lib/coupons/types';

const tabs = [{ type: 'WADIZ', label: '와디즈 쿠폰' }, { type: 'GENERAL', label: '일반 쿠폰' }] as const;

export default function CouponTabs({ value, availability, disabled, onChange }: {
  value: CouponType; availability: CouponAvailability; disabled: boolean; onChange: (value: CouponType) => void;
}) {
  const availableTabs = tabs.filter(({ type }) => isCouponEnabled(availability, type));
  const focusableType = isCouponEnabled(availability, value) ? value : availableTabs[0]?.type;
  return (
    <div role="tablist" aria-label="쿠폰 종류" className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
      {tabs.map(({ type, label }) => (
        <button key={type} id={`coupon-tab-${type}`} type="button" role="tab"
          aria-selected={value === type} aria-controls="coupon-panel" tabIndex={focusableType === type ? 0 : -1}
          disabled={disabled || !isCouponEnabled(availability, type)} onClick={() => onChange(type)}
          onKeyDown={(event) => {
            const index = availableTabs.findIndex((tab) => tab.type === type);
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? availableTabs.length - 1
              : event.key === 'ArrowRight' ? (index + 1) % availableTabs.length
                : event.key === 'ArrowLeft' ? (index - 1 + availableTabs.length) % availableTabs.length : null;
            if (next === null || disabled || !availableTabs[next]) return;
            event.preventDefault();
            onChange(availableTabs[next].type);
            document.getElementById(`coupon-tab-${availableTabs[next].type}`)?.focus();
          }}
          className={`rounded-lg px-2 py-2 text-sm font-semibold outline-offset-2 disabled:opacity-50 ${value === type ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
          {label}{' '}
          {!isCouponEnabled(availability, type) && <span className="block whitespace-nowrap text-xs font-normal">등록 불가</span>}
        </button>
      ))}
    </div>
  );
}
