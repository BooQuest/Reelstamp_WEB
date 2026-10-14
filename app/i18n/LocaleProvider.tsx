'use client';
import { createContext, useContext, useMemo, useState, useTransition, type ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { useRouter } from 'next/navigation';
import { type Locale, LOCALE_COOKIE, LOCALE_MAX_AGE } from './config';
import { createUiText, messagesFor } from './text';
const LocaleContext = createContext<{ locale: Locale; enabled: boolean; pending: boolean; change: (locale: Locale) => void }>({ locale: 'ko', enabled: false, pending: false, change: () => {} });
export const useUiLocale = () => useContext(LocaleContext);
export function useUiText() {
  const { locale } = useUiLocale();
  return useMemo(() => createUiText(locale), [locale]);
}
export default function LocaleProvider({ initialLocale, enabled, children }: { initialLocale: Locale; enabled: boolean; children: ReactNode }) {
  const [locale, setLocale] = useState(initialLocale);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const change = (next: Locale) => {
    if (next === locale || (next === 'en' && !enabled)) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=${LOCALE_MAX_AGE}; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    setLocale(next);
    document.documentElement.lang = next;
    startTransition(() => router.refresh());
  };
  return <LocaleContext.Provider value={{ locale, enabled, pending, change }}>
    <NextIntlClientProvider locale={locale} messages={messagesFor(locale)} timeZone="Asia/Seoul">{children}</NextIntlClientProvider>
  </LocaleContext.Provider>;
}
