'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, LockKeyhole, X } from 'lucide-react';
import { APP_TOAST_EVENT, type AppToastPayload, type AppToastTone } from '@/app/lib/ui/toast';
import { clsx } from '@/app/lib/utils/clsx';

const DEFAULT_DURATION_MS = 2600;
const EXIT_ANIMATION_MS = 220;

type ActiveToast = {
  message: string;
  tone: AppToastTone;
};

export default function AppToast() {
  const [toast, setToast] = useState<ActiveToast | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const clearExitTimer = useCallback(() => {
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  }, []);

  const dismissToast = useCallback(() => {
    clearDismissTimer();
    clearExitTimer();
    setIsExiting(true);
    exitTimerRef.current = setTimeout(() => {
      setToast(null);
      setIsExiting(false);
      exitTimerRef.current = null;
    }, EXIT_ANIMATION_MS);
  }, [clearDismissTimer, clearExitTimer]);

  useEffect(() => {
    const handleToast = (event: Event) => {
      const payload = (event as CustomEvent<AppToastPayload>).detail;
      const message = payload?.message?.trim();
      if (!message) {
        return;
      }

      clearDismissTimer();
      clearExitTimer();
      setIsExiting(false);
      setToast({
        message,
        tone: payload.tone ?? 'default',
      });

      dismissTimerRef.current = setTimeout(() => {
        dismissToast();
      }, payload.durationMs ?? DEFAULT_DURATION_MS);
    };

    window.addEventListener(APP_TOAST_EVENT, handleToast);

    return () => {
      clearDismissTimer();
      clearExitTimer();
      window.removeEventListener(APP_TOAST_EVENT, handleToast);
    };
  }, [clearDismissTimer, clearExitTimer, dismissToast]);

  if (!toast) {
    return null;
  }

  const Icon = toast.tone === 'error' ? LockKeyhole : Check;

  return (
    <div
      role="status"
      aria-live="polite"
      className={clsx(
        'pointer-events-none fixed left-1/2 z-[10001] w-[calc(100vw-2rem)] max-w-[440px] -translate-x-1/2 px-0 transition-all duration-200 ease-out',
        isExiting ? 'translate-y-[-4px] opacity-0' : 'translate-y-0 opacity-100'
      )}
      style={{ top: 'calc(76px + env(safe-area-inset-top, 0px))' }}
    >
      <div
        className={clsx(
          'pointer-events-auto relative overflow-hidden rounded-2xl border px-4 py-3 shadow-[0_18px_46px_rgba(15,23,42,0.32)] backdrop-blur-xl sm:px-5 sm:py-4',
          toast.tone === 'error'
            ? 'border-white/10 bg-[#11131A]/95 text-white'
            : 'border-white/12 bg-[#151923]/95 text-white'
        )}
      >
        <div
          className={clsx(
            'absolute inset-y-0 left-0 w-1',
            toast.tone === 'error' ? 'bg-[#FF4D6D]' : 'bg-white/35'
          )}
        />
        <div className="flex items-center gap-3">
          <span
            className={clsx(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-lg',
              toast.tone === 'error'
                ? 'bg-[#FF4D6D] shadow-[#FF4D6D]/30'
                : 'bg-white/12 shadow-black/10'
            )}
          >
            <Icon className="h-[18px] w-[18px] text-white" strokeWidth={2.6} aria-hidden="true" />
          </span>
          <p className="min-w-0 flex-1 text-sm font-bold leading-5 tracking-normal text-white sm:text-base">
            {toast.message}
          </p>
          <button
            type="button"
            onClick={dismissToast}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="알림 닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
