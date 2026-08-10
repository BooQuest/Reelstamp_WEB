'use client';

import { Instagram, X } from 'lucide-react';

type InstagramPlaybackFallbackProps = {
  instagramUrl: string;
  onCancel: () => void;
};

export default function InstagramPlaybackFallback({
  instagramUrl,
  onCancel,
}: InstagramPlaybackFallbackProps) {
  return (
    <div
      className="absolute inset-0 z-[60] flex items-center justify-center bg-black/72 px-4 text-white backdrop-blur-sm"
      role="dialog"
      aria-label="Instagram 재생 안내"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerMove={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onPointerCancel={(event) => event.stopPropagation()}
    >
      <div className="w-full max-w-[280px] rounded-2xl border border-white/10 bg-[#151923]/95 px-4 py-5 text-center shadow-2xl">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#FF4D6D] shadow-lg shadow-[#FF4D6D]/25">
          <Instagram className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <p className="text-sm font-extrabold leading-5 tracking-normal text-white">
          해당 릴스는 인스타그램에서만 재생됩니다.
        </p>
        <p className="mt-1 text-xs font-semibold leading-5 tracking-normal text-white/70">
          인스타그램으로 이동할까요?
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <a
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-[#FF4D6D] px-2 text-xs font-extrabold text-white transition-colors hover:bg-[#FF5F7A]"
          >
            <Instagram className="h-4 w-4" aria-hidden="true" />
            <span>이동하기</span>
          </a>
          <button
            type="button"
            onClick={onCancel}
            className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/10 px-2 text-xs font-extrabold text-white transition-colors hover:bg-white/20"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            <span>취소</span>
          </button>
        </div>
      </div>
    </div>
  );
}
