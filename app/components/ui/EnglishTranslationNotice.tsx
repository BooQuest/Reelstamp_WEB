import { getUiLocale } from '@/app/i18n/server';

export default async function EnglishTranslationNotice() {
  if (await getUiLocale() !== 'en') return null;

  return (
    <p lang="en" className="-mt-4 mb-10 border-b border-gray-100 pb-6 text-sm leading-6 text-gray-500">
      This English translation is provided for convenience only. In case of any conflict, the Korean version prevails.
    </p>
  );
}
