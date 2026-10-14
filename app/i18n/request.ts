import { getRequestConfig } from 'next-intl/server';
import { getUiLocale } from './server';
import { messagesFor } from './text';
export default getRequestConfig(async () => {
  const locale = await getUiLocale();
  return { locale, messages: messagesFor(locale), timeZone: 'Asia/Seoul' };
});
