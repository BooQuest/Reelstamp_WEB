export type Locale = 'ko' | 'en';
export const LOCALE_COOKIE = 'reelstamp_locale';
export const LOCALE_MAX_AGE = 60 * 60 * 24 * 365;
export const isLocale = (value: unknown): value is Locale => value === 'ko' || value === 'en';
export const englishEnabled = () => process.env.REELSTAMP_ENGLISH_ENABLED === 'true';
export function resolveLocale(value: unknown, enabled: boolean): Locale {
  return enabled && value === 'en' ? 'en' : 'ko';
}
