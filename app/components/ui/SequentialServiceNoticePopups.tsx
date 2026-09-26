'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check } from 'lucide-react';

type ServiceNotice = {
  id: string;
  title: string;
  content: ReactNode;
};

// Temporary beta notices: active from 2026-09-07 00:00 until 2026-10-05 00:00 KST.
const NOTICE_START_AT = '2026-09-06T15:00:00.000Z';
const NOTICE_END_AT = '2026-10-04T15:00:00.000Z';

export const SERVICE_NOTICE_STORAGE_KEY_PREFIX =
  'reelstamp:temporary-service-notice-dismissed:2026-beta-v1';

const TEMPORARY_SERVICE_NOTICES: ServiceNotice[] = [
  {
    id: 'launch-schedule-change',
    title: '정식 출시 일정 변경 안내 (10/5 출시 예정)',
    content: (
      <>
        <p>
          보다 안정적인 서비스 제공을 위한 기능 점검으로 인해 정식 출시 일정을{' '}
          <strong className="font-bold text-gray-950">10월 5일로</strong> 변경하게
          되었습니다. 남은 기간 동안 기능 안정성과 사용성을 더욱 꼼꼼히 점검하여 더
          나은 모습으로 찾아뵙겠습니다.
        </p>
        <p>
          <strong className="font-bold text-gray-950">
            정식 출시 전까지는 현재 베타 서비스를 계속 자유롭게 이용하실 수 있으며,
            릴스탬프의 모든 템플릿을 무료로 사용하실 수 있습니다.
          </strong>
        </p>
        <p>
          오류 제보 및 기능 개선 요청은{' '}
          <strong className="font-bold text-gray-950">마이페이지 &gt; 고객센터</strong>를
          이용해주세요. 보내주시는 의견을 적극 반영하여 더욱 만족스러운 서비스를
          만들어가겠습니다.
        </p>
      </>
    ),
  },
  {
    id: 'feature-stabilization',
    title: '일부 기능 안정화 작업 안내',
    content: (
      <p>
        현재 자막 편집 기능 및 촬영 화질 개선 작업 진행 중으로 해당 기능 사용 시 원활하지
        않을 수 있음을 안내드립니다. 그 외에도 사용자의 편의를 위한 다양한 기능을 추가
        중이니 조금만 기다려 주시면 감사하겠습니다.
      </p>
    ),
  },
];

const getDismissKey = (noticeId: string) =>
  `${SERVICE_NOTICE_STORAGE_KEY_PREFIX}:${noticeId}`;

const isWithinNoticePeriod = (referenceDate: Date) => {
  const timestamp = referenceDate.getTime();
  return timestamp >= Date.parse(NOTICE_START_AT) && timestamp < Date.parse(NOTICE_END_AT);
};

const isNoticeDismissed = (noticeId: string) => {
  try {
    return window.localStorage.getItem(getDismissKey(noticeId)) === 'true';
  } catch {
    return false;
  }
};

const dismissNotice = (noticeId: string) => {
  try {
    window.localStorage.setItem(getDismissKey(noticeId), 'true');
  } catch {
    // Storage can be unavailable in restricted browser modes; the popup should still close.
  }
};

const subscribeToHydration = () => () => {};
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

type SequentialServiceNoticePopupsProps = {
  referenceDate?: Date;
};

export default function SequentialServiceNoticePopups({
  referenceDate,
}: SequentialServiceNoticePopupsProps) {
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot
  );
  const [closedNoticeIds, setClosedNoticeIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const now = referenceDate ?? new Date();
  const currentNotice =
    isHydrated && isWithinNoticePeriod(now)
      ? TEMPORARY_SERVICE_NOTICES.find(
          (notice) => !closedNoticeIds.has(notice.id) && !isNoticeDismissed(notice.id)
        ) ?? null
      : null;

  const closeCurrentNotice = useCallback(() => {
    if (!currentNotice) {
      return;
    }

    if (dontShowAgain) {
      dismissNotice(currentNotice.id);
    }

    setDontShowAgain(false);
    setClosedNoticeIds((noticeIds) => {
      const nextNoticeIds = new Set(noticeIds);
      nextNoticeIds.add(currentNotice.id);
      return nextNoticeIds;
    });
  }, [currentNotice, dontShowAgain]);

  useEffect(() => {
    if (!currentNotice) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [currentNotice]);

  useEffect(() => {
    if (!currentNotice) {
      return;
    }

    confirmButtonRef.current?.focus({ preventScroll: true });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeCurrentNotice();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeCurrentNotice, currentNotice]);

  if (!isHydrated || !currentNotice) {
    return null;
  }

  return createPortal(
    <AnimatePresence mode="wait">
      <motion.div
        key={currentNotice.id}
        className="fixed inset-0 z-[10020] flex items-center justify-center px-4 py-3 sm:py-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`service-notice-title-${currentNotice.id}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-hidden="true" />
        <motion.div
          className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-[440px] overflow-y-auto rounded-lg border border-gray-100 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.26)] sm:max-h-[calc(100dvh-3rem)]"
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <div className="h-1.5 bg-gradient-to-r from-[#FF496D] via-[#EB48B1] to-[#F59A39]" />
          <div className="p-4 sm:p-6">
            <div>
              <h2
                id={`service-notice-title-${currentNotice.id}`}
                className="text-lg font-extrabold leading-6 text-gray-950 [word-break:keep-all] sm:text-xl sm:leading-7 [@media(max-height:600px)]:text-base [@media(max-height:600px)]:leading-[22px]"
              >
                {currentNotice.title}
              </h2>
              <div className="mt-3 space-y-2 text-[13px] leading-5 text-gray-700 [word-break:keep-all] sm:text-sm sm:leading-6 [@media(max-height:600px)]:text-xs [@media(max-height:600px)]:leading-[18px]">
                {currentNotice.content}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
              <label className="inline-flex select-none items-center gap-2 whitespace-nowrap text-xs font-semibold text-gray-600 sm:text-sm">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(event) => setDontShowAgain(event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 accent-[#FF496D]"
                />
                다시 보지 않기
              </label>
              <button
                ref={confirmButtonRef}
                type="button"
                onClick={closeCurrentNotice}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#FF496D] px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#E63E60] focus:outline-none focus:ring-2 focus:ring-[#FF496D]/35 focus:ring-offset-2 sm:min-w-28"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                확인
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
