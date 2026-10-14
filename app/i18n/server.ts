import 'server-only';
import { cookies } from 'next/headers';
import { englishEnabled, LOCALE_COOKIE, resolveLocale } from './config';
import { createUiText } from './text';
export async function getUiLocale() {
  return resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value, englishEnabled());
}
export async function getUiText() { return createUiText(await getUiLocale()); }
