import type { UiText } from '@/app/i18n/text';
import type { Locale } from '@/app/i18n/config';

export function catalogName(product: { name: string; locale?: Locale }, t: UiText) {
  return (product.locale ?? 'ko') === t.locale ? product.name : t('불러오는 중입니다.');
}

export function purchasedPassName(
  source: { productName: string; displayProductName?: string; displayLocale?: Locale },
  t: UiText,
) {
  if ((source.displayLocale ?? 'ko') !== t.locale) return t('불러오는 중입니다.');
  return source.displayProductName ?? (t.locale === 'ko' ? source.productName : 'Access pass');
}
