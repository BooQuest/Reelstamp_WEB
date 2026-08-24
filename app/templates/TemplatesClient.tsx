'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bookmark, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/app/components/providers/AuthProvider';
import { useSavedTemplates, type TemplateSummary } from '@/app/hooks/useSavedTemplates';
import type { WebApiResponse } from '@/app/lib/api/auth';
import TemplateMediaPreview from '@/app/components/ui/TemplateMediaPreview';
import TemplateAccessBadge from '@/app/components/ui/TemplateAccessBadge';
import { isInstagramPlaybackTriggerTarget } from '@/app/lib/ui/instagramPlaybackTrigger';
import {
  buildTemplateLoginHref,
  canUseTemplate,
  isGuestTemplateUser,
  isPaidTemplate,
  resolveTemplateAccessType,
  resolveRestrictedTemplateLoginReturnUrl,
  shouldWaitForPaidTemplateSubscription,
  TEMPLATE_LOGIN_REQUIRED_MESSAGE,
  TEMPLATE_PAYMENT_PATH,
  type TemplateAccessType,
} from '@/app/lib/templates/access';
import { showAppToast } from '@/app/lib/ui/toast';

type TodayTrendCardStatus = 'AVAILABLE' | 'REQUESTABLE' | 'REQUESTED' | 'COMING_SOON';

type TodayTrendCard = {
  id: string;
  trendReelId: string;
  templateId?: string | null;
  title: string;
  subtitle: string;
  thumbnailUrl?: string | null;
  embedUrl?: string | null;
  instagramOnly?: boolean;
  tags: string[];
  accessType?: TemplateAccessType | null;
  status: TodayTrendCardStatus;
  requestCount: number;
  requestedByMe: boolean;
};

type TodayTrendListResponse = {
  cards: TodayTrendCard[];
};

type TemplateRequestResponse = {
  trendReelId: string;
  requested: boolean;
  requestCount: number;
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const buildReelsMakerHref = (templateId: string) =>
  `/reels-maker?templateId=${encodeURIComponent(templateId)}&returnUrl=${encodeURIComponent('/templates')}`;

const normalizeCard = (card: TodayTrendCard): TodayTrendCard => ({
  ...card,
  trendReelId: card.trendReelId || card.id,
  subtitle: card.subtitle ?? '',
  thumbnailUrl: card.thumbnailUrl?.trim() || null,
  embedUrl: card.embedUrl ?? null,
  instagramOnly: Boolean(card.instagramOnly),
  tags: Array.isArray(card.tags) ? card.tags : [],
  requestCount: Number(card.requestCount || 0),
  requestedByMe: Boolean(card.requestedByMe),
});

const isAvailableCard = (card: TodayTrendCard | null) =>
  Boolean(card?.templateId && card.status === 'AVAILABLE');

const getCardStatusLabel = (card: TodayTrendCard) => {
  switch (card.status) {
    case 'REQUESTABLE':
      return '요청 가능';
    case 'REQUESTED':
      return '요청 완료';
    case 'COMING_SOON':
      return '추가 예정';
    default:
      return '';
  }
};

export default function TemplatesClient() {
  const router = useRouter();
  const { isAuthenticated, user, subscription, isLoadingSubscription } = useAuth();
  const [activeIndex, setActiveIndex] = useState(0);
  const [cards, setCards] = useState<TodayTrendCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestingTrendId, setRequestingTrendId] = useState<string | null>(null);
  const [playbackFallbackCardId, setPlaybackFallbackCardId] = useState<string | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const accessRedirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { savedSet, toggleSave } = useSavedTemplates({ returnUrl: '/templates' });

  const handlePrev = () => {
    setPlaybackFallbackCardId(null);
    setActiveIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setPlaybackFallbackCardId(null);
    const limit = Math.min(cards.length, 3);
    if (limit === 0) {
      return;
    }
    setActiveIndex((prev) => Math.min(limit - 1, prev + 1));
  };

  const handleCarouselPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isInstagramPlaybackTriggerTarget(event.target)) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    swipeStartRef.current = {
      x: event.clientX,
      y: event.clientY,
    };
  };

  const handleCarouselPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const start = swipeStartRef.current;
    swipeStartRef.current = null;

    if (!start) {
      return;
    }

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const isHorizontalSwipe = Math.abs(deltaX) > 44 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2;

    if (!isHorizontalSwipe) {
      return;
    }

    if (deltaX < 0) {
      handleNext();
      return;
    }

    handlePrev();
  };

  const handleCarouselPointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    swipeStartRef.current = null;
  };

  const handlePlaybackFallbackVisibilityChange = useCallback(
    (cardId: string, isVisible: boolean) => {
      setPlaybackFallbackCardId((currentCardId) => {
        if (isVisible) {
          return cardId;
        }

        return currentCardId === cardId ? null : currentCardId;
      });
    },
    []
  );

  const handleSaveCard = (card: TodayTrendCard) => {
    if (!isAvailableCard(card) || !card.templateId) {
      return;
    }

    const template: TemplateSummary = {
      id: card.templateId,
      title: card.title,
      subtitle: card.subtitle,
      thumbnailUrl: card.thumbnailUrl,
      embedUrl: card.embedUrl,
      instagramOnly: card.instagramOnly,
      tags: card.tags,
      accessType: card.accessType,
    };
    toggleSave(template);
  };

  const redirectToTemplateLogin = (returnUrl?: string) => {
    showAppToast({
      message: TEMPLATE_LOGIN_REQUIRED_MESSAGE,
      tone: 'error',
    });
    if (accessRedirectTimerRef.current) {
      clearTimeout(accessRedirectTimerRef.current);
    }
    accessRedirectTimerRef.current = setTimeout(() => {
      router.push(buildTemplateLoginHref(returnUrl));
    }, 800);
  };

  const handleRestrictedPaidTemplate = (destination?: string) => {
    if (!isAuthenticated || isGuestTemplateUser(user)) {
      redirectToTemplateLogin(resolveRestrictedTemplateLoginReturnUrl(destination));
      return;
    }

    router.push(TEMPLATE_PAYMENT_PATH);
  };

  const handlePrimaryAction = async () => {
    if (!activeCard) {
      return;
    }

    if (isAvailableCard(activeCard) && activeCard.templateId) {
      const destination = buildReelsMakerHref(activeCard.templateId);
      if (isPaidTemplate(activeCard) && !canUseTemplate({
        template: activeCard,
        isAuthenticated,
        user,
        subscription,
      })) {
        handleRestrictedPaidTemplate(destination);
        return;
      }
      router.push(
        isAuthenticated
          ? destination
          : `/login?returnUrl=${encodeURIComponent(destination)}`
      );
      return;
    }

    if (!isAuthenticated) {
      router.push('/login?returnUrl=' + encodeURIComponent('/templates'));
      return;
    }

    if (activeCard.status !== 'REQUESTABLE' || requestingTrendId) {
      return;
    }

    try {
      setRequestError(null);
      setRequestingTrendId(activeCard.trendReelId);

      const response = await fetch('/api/template-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trendReelId: activeCard.trendReelId }),
      });
      const payload: WebApiResponse<TemplateRequestResponse> = await response.json();

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || '템플릿 요청에 실패했습니다.');
      }

      const requestedTrendReelId = payload.data?.trendReelId ?? activeCard.trendReelId;
      const requestCount = payload.data?.requestCount ?? activeCard.requestCount + 1;
      setCards((prev) =>
        prev.map((card) =>
          card.trendReelId === requestedTrendReelId
            ? {
                ...card,
                status: 'REQUESTED',
                requestedByMe: true,
                requestCount,
              }
            : card
        )
      );
    } catch (error: unknown) {
      setRequestError(getErrorMessage(error, '템플릿 요청에 실패했습니다.'));
    } finally {
      setRequestingTrendId(null);
    }
  };

  const getCardStyle = (index: number) => {
    const delta = index - activeIndex;
    if (delta === 0) {
      return {
        zIndex: isActivePlaybackFallbackVisible ? 80 : 30,
        opacity: 1,
        filter: 'brightness(1)',
        transform: 'translate(-50%, -50%) translateX(0%) translateY(0px) scale(1)',
        pointerEvents: 'auto' as const,
      };
    }

    const distance = Math.abs(delta);
    const direction = delta > 0 ? 1 : -1;
    const offsetX = 58 * distance;
    const offsetY = direction > 0 ? 8 + (distance - 1) * 8 : 22 + (distance - 1) * 12;
    const scale = Math.max(0.88, 0.95 - (distance - 1) * 0.04);
    const dim = distance === 1 ? 0.85 : Math.max(0.68, 0.8 - (distance - 1) * 0.08);

    return {
      zIndex: 30 - distance,
      opacity: 1,
      filter: `brightness(${dim})`,
      transform: `translate(-50%, -50%) translateX(${direction * offsetX}%) translateY(${offsetY}px) scale(${scale})`,
      pointerEvents: 'none' as const,
    };
  };

  useEffect(() => {
    let isMounted = true;

    const loadTodayTrends = async () => {
      setIsLoading(true);
      setLoadError(null);
      setRequestError(null);

      try {
        const response = await fetch('/api/templates/today-trends', {
          method: 'GET',
          cache: 'no-store',
        });
        const payload: WebApiResponse<TodayTrendListResponse> = await response.json();

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || '오늘의 릴스 트렌드를 불러오지 못했습니다.');
        }

        const normalized = (payload.data?.cards ?? []).map(normalizeCard);

        if (isMounted) {
          setCards(normalized);
          setActiveIndex(0);
        }
      } catch (error: unknown) {
        if (isMounted) {
          setLoadError(getErrorMessage(error, '오늘의 릴스 트렌드를 불러오지 못했습니다.'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadTodayTrends();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (accessRedirectTimerRef.current) {
        clearTimeout(accessRedirectTimerRef.current);
      }
    };
  }, []);

  const recommendations = useMemo(() => cards.slice(0, 3), [cards]);
  const activeCard = useMemo(
    () => recommendations[activeIndex] ?? null,
    [recommendations, activeIndex]
  );
  const isActivePlaybackFallbackVisible = Boolean(
    activeCard && playbackFallbackCardId === activeCard.id
  );
  const isRequestingActiveCard = Boolean(activeCard && requestingTrendId === activeCard.trendReelId);
  const isActiveCardAccessLoading = Boolean(
    isAvailableCard(activeCard) &&
      shouldWaitForPaidTemplateSubscription({
        template: activeCard,
        isAuthenticated,
        user,
        isLoadingSubscription,
      })
  );
  const primaryButtonText = useMemo(() => {
    if (!activeCard) {
      return '3분 만에 만들기';
    }
    if (isActiveCardAccessLoading) {
      return '권한 확인 중...';
    }
    if (isRequestingActiveCard) {
      return '요청 중...';
    }
    if (isAvailableCard(activeCard)) {
      return '3분 만에 만들기';
    }
    if (activeCard.status === 'REQUESTABLE') {
      return '템플릿 요청';
    }
    if (activeCard.status === 'REQUESTED') {
      return '요청 완료';
    }
    return '추가 예정';
  }, [activeCard, isActiveCardAccessLoading, isRequestingActiveCard]);
  const isPrimaryButtonDisabled =
    !activeCard ||
    isActiveCardAccessLoading ||
    isRequestingActiveCard ||
    activeCard.status === 'REQUESTED' ||
    activeCard.status === 'COMING_SOON' ||
    (activeCard.status === 'AVAILABLE' && !activeCard.templateId);

  useEffect(() => {
    if (activeIndex >= recommendations.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, recommendations.length]);

  return (
    <div className="min-h-[calc(100vh-80px)] max-w-full overflow-x-hidden bg-black text-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 pt-6 pb-8 sm:pt-10 sm:pb-12">
        <div className="flex flex-col items-center text-center gap-2 mb-3 sm:mb-5">
          <p className="text-sm text-white/60 tracking-[0.3em] uppercase">맞춤형 릴스 추천</p>
          <h2 className="text-2xl sm:text-3xl font-bold">오늘의 릴스 트렌드</h2>
        </div>

        <div
          className="relative left-1/2 flex h-[370px] w-screen max-w-none -translate-x-1/2 touch-pan-y select-none items-center justify-center overflow-hidden overscroll-x-none pb-2 sm:h-[470px] sm:pb-3 md:h-[490px] lg:h-[510px]"
          onPointerDown={handleCarouselPointerDown}
          onPointerUp={handleCarouselPointerUp}
          onPointerCancel={handleCarouselPointerCancel}
        >
          {isLoading && (
            <div className="text-sm sm:text-base text-white/70">템플릿을 불러오는 중입니다...</div>
          )}
          {!isLoading && loadError && (
            <div className="text-sm sm:text-base text-rose-300">{loadError}</div>
          )}
          {!isLoading && !loadError && recommendations.length === 0 && (
            <div className="text-sm sm:text-base text-white/70">추천 릴스가 없습니다.</div>
          )}
          {!isLoading && !loadError && recommendations.map((card, index) => {
            const isActive = index === activeIndex;
            const isAvailable = isAvailableCard(card);
            const isSaved = Boolean(card.templateId && savedSet.has(card.templateId));
            const statusLabel = getCardStatusLabel(card);
            return (
              <div
                key={card.id}
                className="absolute left-1/2 top-1/2 w-[78vw] max-w-[360px] sm:w-[320px] lg:w-[360px] aspect-[3/4] rounded-[28px] overflow-hidden shadow-2xl transition-all duration-500 ease-out"
                style={getCardStyle(index)}
                aria-hidden={!isActive}
              >
                <TemplateMediaPreview
                  title={card.title}
                  thumbnailUrl={card.thumbnailUrl}
                  embedUrl={card.embedUrl}
                  instagramOnly={card.instagramOnly}
                  disableEmbedInteraction={!isActive}
                  preferEmbed
                  onPlaybackFallbackVisibilityChange={(isVisible) =>
                    handlePlaybackFallbackVisibilityChange(card.id, isVisible)
                  }
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/80" />

                <div className="pointer-events-none absolute top-4 left-4 flex h-12 min-w-[98px] items-center justify-center rounded-full bg-[#FF4D6D] px-5 text-base font-extrabold leading-none shadow-lg sm:h-14 sm:min-w-[112px] sm:text-lg">
                  추천 {index + 1}
                </div>
                <TemplateAccessBadge
                  accessType={resolveTemplateAccessType(card)}
                  className="pointer-events-none absolute left-4 top-[70px] z-40 sm:top-[82px]"
                />

                {isAvailable ? (
                  <button
                    type="button"
                    onClick={() => handleSaveCard(card)}
                    aria-pressed={isSaved}
                    className="absolute top-4 right-4 z-40 w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center hover:bg-white/30 transition-colors"
                  >
                    <Bookmark
                      className={isSaved ? 'text-[#FF4D6D]' : 'text-white'}
                      fill={isSaved ? '#FF4D6D' : 'none'}
                    />
                  </button>
                ) : (
                  <div className="pointer-events-none absolute top-4 right-4 z-40 min-h-10 rounded-full bg-white/20 backdrop-blur px-4 flex items-center justify-center text-xs font-extrabold text-white shadow-lg">
                    {statusLabel}
                  </div>
                )}

                <div className="pointer-events-none absolute bottom-0 left-0 right-0 px-5 pb-6 pt-12">
                  <h3 className="text-xl sm:text-2xl font-bold mb-2 drop-shadow-lg">
                    {card.title}
                  </h3>
                  <p className="text-sm text-white/80 mb-4 leading-relaxed line-clamp-2">
                    {card.subtitle}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {card.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 text-xs font-semibold rounded-full bg-white/15 text-white/90"
                      >
                        #{tag}
                      </span>
                    ))}
                    {!isAvailable && card.requestCount > 0 && (
                      <span className="px-3 py-1 text-xs font-semibold rounded-full bg-[#FF4D6D]/90 text-white">
                        요청 {card.requestCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {!isLoading && !loadError && recommendations.length > 1 && activeIndex > 0 && (
            <button
              type="button"
              onClick={handlePrev}
              onPointerDown={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
              aria-label="이전 추천"
              className="absolute left-4 top-1/2 z-50 -translate-y-1/2 w-11 h-11 rounded-full bg-[#FF4D6D] shadow-lg flex items-center justify-center hover:scale-105 transition-transform sm:left-8"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
          )}
          {!isLoading && !loadError && recommendations.length > 1 && activeIndex < recommendations.length - 1 && (
            <button
              type="button"
              onClick={handleNext}
              onPointerDown={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
              aria-label="다음 추천"
              className="absolute right-4 top-1/2 z-50 -translate-y-1/2 w-11 h-11 rounded-full bg-[#FF4D6D] shadow-lg flex items-center justify-center hover:scale-105 transition-transform sm:right-8"
            >
              <ChevronRight className="w-5 h-5 text-white" />
            </button>
          )}
        </div>

        <div className="mt-0 flex flex-col items-center gap-3 sm:gap-4">
          {requestError && (
            <p className="w-full max-w-md text-center text-sm font-semibold text-rose-300">
              {requestError}
            </p>
          )}
          <button
            type="button"
            onClick={handlePrimaryAction}
            className="w-full max-w-md py-4 text-base sm:text-lg font-semibold rounded-full bg-[#FF4D6D] hover:bg-[#FF5F7A] transition-colors shadow-lg disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/50 disabled:shadow-none"
            disabled={isPrimaryButtonDisabled}
          >
            {primaryButtonText}
          </button>
          <Link
            href="/all-templates"
            className="w-full max-w-md py-4 text-base sm:text-lg font-semibold rounded-full bg-[#2B2B2B] text-white/90 hover:bg-[#3A3A3A] transition-colors text-center"
          >
            다른 템플릿 보러가기
          </Link>
        </div>
      </div>
    </div>
  );
}
