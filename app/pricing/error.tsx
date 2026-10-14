'use client';
import { useUiText } from '@/app/i18n/LocaleProvider';

export default function PricingError({ reset }: { reset: () => void }) {
  const t = useUiText();
  return (
    <main className="p-12 text-center">
      <h1 className="text-xl font-bold">{t("이용권 정보를 불러오지 못했습니다.")}</h1>
      <button
        onClick={reset}
        className="mt-6 rounded-xl bg-[#FF496D] px-6 py-3 text-white"
      >
        {t("다시 시도")}</button>
    </main>
  );
}
