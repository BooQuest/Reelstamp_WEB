import LanguageSelector from '@/app/i18n/LanguageSelector';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

export default function FullScreenState({ children }: Props) {
  return (
    <div className="min-h-[100dvh] bg-black text-white flex items-center justify-center px-4">
      <div className="absolute right-4 top-4"><LanguageSelector /></div>
      {children}
    </div>
  );
}
