'use client';
import { useSyncExternalStore } from 'react';
import { createUiText } from './i18n/text';
const subscribe = () => () => {};
const clientLocale = () => document.documentElement.lang === 'en' ? 'en' : 'ko';
const serverLocale = () => 'ko' as const;
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  const locale = useSyncExternalStore(subscribe, clientLocale, serverLocale);
  const t = createUiText(locale);
  return <html lang={locale}><body><main style={{ padding: 32, textAlign: 'center' }}>
    <h1>{t('잠시 연결이 원활하지 않아요')}</h1><p>{t('잠시 후 다시 시도해 주세요.')}</p>
    <button onClick={reset}>{t('다시 시도')}</button>
  </main></body></html>;
}
