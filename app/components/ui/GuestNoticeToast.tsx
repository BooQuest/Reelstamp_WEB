'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { useAuth } from '@/app/components/providers/AuthProvider';

const DISMISS_KEY_PREFIX = 'reelstamp:guest-notice-dismissed';
const DISMISS_CHANGE_EVENT = 'reelstamp:guest-notice-dismissed-change';

const subscribeToDismissal = (onStoreChange: () => void) => {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const listener = () => onStoreChange();
  window.addEventListener('storage', listener);
  window.addEventListener(DISMISS_CHANGE_EVENT, listener);

  return () => {
    window.removeEventListener('storage', listener);
    window.removeEventListener(DISMISS_CHANGE_EVENT, listener);
  };
};

const getDismissedSnapshot = (dismissKey: string) => {
  if (typeof window === 'undefined') {
    return true;
  }

  return sessionStorage.getItem(dismissKey) === 'true';
};

export default function GuestNoticeToast() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  const isGuestUser = Boolean(user?.guest || user?.provider === 'GUEST');
  const shouldHideOnPage = pathname.startsWith('/login');
  const guestIdentity = user ? user.id || user.userId || user.nickname || 'unknown' : 'anonymous';
  const dismissKey = useMemo(() => {
    return `${DISMISS_KEY_PREFIX}:${guestIdentity}`;
  }, [guestIdentity]);

  const isDismissed = useSyncExternalStore(
    subscribeToDismissal,
    () => getDismissedSnapshot(dismissKey),
    () => true
  );

  if (!isGuestUser || shouldHideOnPage || isDismissed) {
    return null;
  }

  const nickname = user?.nickname || '게스트';

  const handleClose = () => {
    sessionStorage.setItem(dismissKey, 'true');
    window.dispatchEvent(new Event(DISMISS_CHANGE_EVENT));
  };

  const handleUpgradeClick = () => {
    router.push('/login');
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 left-4 right-4 z-[10000] mx-auto max-w-[440px] md:left-auto md:right-6 md:mx-0"
    >
      <div className="rounded-xl border border-[#FF496D]/25 bg-white px-4 py-4 shadow-2xl shadow-[#FF496D]/10">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">
              {nickname}님은 가입 없이 이용 중입니다.
            </p>
            <p className="mt-1.5 text-xs leading-5 text-gray-600">
              작업 내용을 안전하게 보관하려면 회원가입 후 이용하는 것을 권장합니다.
              쿠키 삭제, 브라우저 변경, 로그아웃 시 게스트 작업 접근이 어려울 수 있습니다.
            </p>
            <button
              type="button"
              onClick={handleUpgradeClick}
              className="mt-3 rounded-lg bg-[#FF496D] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#E63E60]"
            >
              회원가입하고 보관하기
            </button>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label="게스트 안내 닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
