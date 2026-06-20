import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

export default function FullScreenState({ children }: Props) {
  return (
    <div className="min-h-[100dvh] bg-black text-white flex items-center justify-center px-4">
      {children}
    </div>
  );
}
