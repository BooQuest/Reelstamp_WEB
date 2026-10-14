import { createTranslator } from 'next-intl';
import type { Locale } from './config';
import { ko, en } from './messages';
import patterns from './messages/patterns.json';
import sources from './messages/sources.json';
export const messagesFor = (locale: Locale) => locale === 'en' ? en : ko;
const normalise = (value: string) => value.replace(/\s+/g, ' ').trim();
const keys = sources as Record<string, string>;
const dynamicPatterns = patterns.map(source => ({ source, regex: new RegExp('^' + source.split(/(\{v\d+\})/).map(part => /^\{v\d+\}$/.test(part) ? '(.+?)' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('') + '$') }));
export type UiText = {
  locale: Locale;
  (value: string): string;
  <T>(value: T): T;
  format: (source: string, values: Record<string, string | number>) => string;
};
export function createUiText(locale: Locale): UiText {
  const translate = createTranslator({ locale, messages: messagesFor(locale) }) as (key: string, values?: Record<string, string | number>) => string;
  const text = (<T>(value: T): T => {
    if (typeof value !== 'string' || locale === 'ko') return value;
    const key = keys[normalise(value)];
    if (key) return ((value.match(/^\s*/)?.[0] ?? '') + translate(key) + (value.match(/\s*$/)?.[0] ?? '')) as T;
    for (const { source, regex } of dynamicPatterns) {
      const match = normalise(value).match(regex);
      if (match) return translate(keys[source], Object.fromEntries(match.slice(1).map((part, index) => [`v${index}`, text(part)]))) as T;
    }
    return value;
  }) as UiText;
  text.locale = locale;
  text.format = (source, values) => {
    const key = keys[normalise(source)];
    if (key) return translate(key, values);
    return source.replace(/\{(\w+)\}/g, (match, name) => String(values[name] ?? match));
  };
  return text;
}
