'use client';

import { useUiText } from '@/app/i18n/LocaleProvider';
import type { EntitlementGrant, EntitlementSummary } from '@/app/lib/coupons/types';
import { COUPON_EXTENSION_NOTICE, couponDateTime } from '@/app/lib/coupons/display';
import Link from 'next/link';
import { wadizBenefit } from '@/app/lib/coupons/localised-display';
import { purchasedPassName } from '@/app/lib/passes/localised-name';
function date(value: string, locale: 'ko' | 'en' = 'ko') {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'ko-KR', {
    timeZone: 'Asia/Seoul',
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: false,
  }).format(new Date(value));
}
export default function PassGrants({
  grants,
  now,
  summary,
}: {
  grants: EntitlementGrant[] | null;
  summary?: EntitlementSummary;
  now: number;
}) {
  const t = useUiText();
  if (!grants)
    return (
      <aside role="alert" className="mb-6 rounded-2xl border p-5">
        {t("기간제 이용권 정보를 불러오지 못했습니다.")}{t(' ')}
        <Link href="/plan" className="text-[#D93256]">
          {t("다시 확인")}</Link>
      </aside>
    );
  if (!grants.length) return null;
  return (
    <section className="mb-6 space-y-4" aria-label={t("기간제 이용권")}>
      {summary?.endsAt && <p className="rounded-xl bg-white p-4 text-sm font-medium">
        {t.format('전체 이용기간: {date}까지', { date: couponDateTime(summary.endsAt, t) })}</p>}
      <aside className="rounded-xl bg-rose-50 p-4 text-xs leading-5 text-gray-600">
        <p>{t(COUPON_EXTENSION_NOTICE)}</p>
      </aside>
      {grants.map((grant) => (
        <article
          key={grant.id}
          className="rounded-2xl border border-rose-100 bg-white p-6"
        >
          {grant.source === 'COUPON' && <p className="mb-1 text-xs text-gray-500">{t(grant.couponType === 'WADIZ' ? '와디즈 쿠폰 이용권' : grant.couponType === 'GENERAL' ? '일반 쿠폰 이용권' : '쿠폰 이용권')}</p>}
          <h2 className="text-lg font-bold">
            {grant.source === 'PURCHASE'
              ? purchasedPassName(grant, t)
              : grant.couponType === 'WADIZ'
                ? wadizBenefit(grant, grant.productName, t)
                : t(grant.productName)}
          </h2>
          <p className="mt-2 text-sm text-[#D93256]">
            {grant.revokedAt
              ? t('환불로 회수됨')
              : Date.parse(grant.endsAt) <= now
                ? t('기간 만료')
                : Date.parse(grant.startsAt) > now
                  ? t('사용 예정')
                  : t('사용 중')}
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <div>
              <dt>{t("이용 시작")}</dt>
              <dd>{t(date(grant.startsAt, t.locale))} {t(" (한국 시간)")}</dd>
            </div>
            <div>
              <dt>{t("이용 종료")}</dt>
              <dd>{t(date(grant.endsAt, t.locale))} {t(" (한국 시간)")}</dd>
            </div>
          </dl>
        </article>
      ))}
    </section>
  );
}
