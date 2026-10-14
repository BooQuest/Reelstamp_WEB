'use client';

import { Fragment } from 'react';
import { useUiLocale } from './LocaleProvider';

const LANGUAGES = [
  { locale: 'ko', label: '한국어' },
  { locale: 'en', label: 'English' },
] as const;

export default function LanguageSelector() {
  const { locale, enabled, change } = useUiLocale();
  if (!enabled) return null;

  return (
    <div role="group" aria-label={locale === 'en' ? 'Language' : '언어 선택'} className="flex shrink-0 items-center gap-0.5 sm:gap-1">
      {LANGUAGES.map((language, index) => (
        <Fragment key={language.locale}>
          {index > 0 && <span aria-hidden="true" className="select-none opacity-30">|</span>}
          <button
            type="button"
            aria-pressed={locale === language.locale}
            onClick={() => change(language.locale)}
            className={`flex h-10 items-center justify-center whitespace-nowrap rounded text-[11px] font-semibold leading-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 sm:px-1 sm:text-xs xl:px-2 xl:text-sm ${
              locale === language.locale
                ? 'text-[#FF496D]'
                : 'text-inherit opacity-60 hover:opacity-100'
            }`}
          >
            {language.label}
          </button>
        </Fragment>
      ))}
    </div>
  );
}
