'use client';

import {
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

type TemplateListResponse = {
  templates: TemplateSummary[];
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export default function TemplatesClient() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [activeIndex, setActiveIndex] = useState(0);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const { savedSet, toggleSave } = useSavedTemplates({ returnUrl: '/templates' });

  const handlePrev = () => {
    setActiveIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    const limit = Math.min(templates.length, 3);
    if (limit === 0) {
      return;
    }
    setActiveIndex((prev) => Math.min(limit - 1, prev + 1));
  };

  const handleCarouselPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
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

  const handleStart = () => {
    if (!activeTemplate) {
      return;
    }
    if (!isAuthenticated) {
      router.push('/login?returnUrl=' + encodeURIComponent('/templates'));
      return;
    }
    router.push(`/reels-maker?templateId=${activeTemplate.id}`);
  };

  const getCardStyle = (index: number) => {
    const delta = index - activeIndex;
    if (delta === 0) {
      return {
        zIndex: 30,
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

    const loadTemplates = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await fetch('/api/templates', {
          method: 'GET',
          cache: 'no-store',
        });
        const payload: WebApiResponse<TemplateListResponse> = await response.json();

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || '템플릿 목록을 불러오지 못했습니다.');
        }

        const normalized = (payload.data?.templates ?? []).map((template) => ({
          ...template,
          subtitle: template.subtitle ?? '',
          thumbnailUrl: template.thumbnailUrl?.trim() || null,
          embedUrl: template.embedUrl ?? null,
          tags: Array.isArray(template.tags) ? template.tags : [],
        }));

        if (isMounted) {
          setTemplates(normalized);
          setActiveIndex(0);
        }
      } catch (error: unknown) {
        if (isMounted) {
          setLoadError(getErrorMessage(error, '템플릿 목록을 불러오지 못했습니다.'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadTemplates();

    return () => {
      isMounted = false;
    };
  }, []);

  const recommendations = useMemo(() => templates.slice(0, 3), [templates]);
  const activeTemplate = useMemo(
    () => recommendations[activeIndex] ?? null,
    [recommendations, activeIndex]
  );

  useEffect(() => {
    if (activeIndex >= recommendations.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, recommendations.length]);

  return (
    <div className="min-h-[calc(100vh-80px)] max-w-full overflow-x-hidden bg-black text-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 pt-8 pb-10 sm:pt-12 sm:pb-14">
        <div className="flex flex-col items-center text-center gap-2 mb-8 sm:mb-10">
          <p className="text-sm text-white/60 tracking-[0.3em] uppercase">맞춤형 릴스 추천</p>
          <h2 className="text-2xl sm:text-3xl font-bold">오늘의 트렌드 릴스 3가지</h2>
          <p className="text-sm sm:text-base text-white/70">
            당신의 비즈니스와 트렌드를 기반으로 바이럴 가능성이 높은 릴스를 추천합니다
          </p>
        </div>

        <div
          className="relative left-1/2 flex h-[520px] w-screen max-w-none -translate-x-1/2 touch-pan-y select-none items-center justify-center overflow-hidden overscroll-x-none pb-6 sm:h-[560px] sm:pb-8 md:h-[600px]"
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
            <div className="text-sm sm:text-base text-white/70">추천 템플릿이 없습니다.</div>
          )}
          {!isLoading && !loadError && recommendations.map((card, index) => {
            const isActive = index === activeIndex;
            const isSaved = savedSet.has(card.id);
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
                  disableEmbedInteraction
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/80" />

                <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-[#FF4D6D] text-xs font-semibold shadow-lg">
                  추천 {index + 1}
                </div>

                <button
                  type="button"
                  onClick={() => toggleSave(card)}
                  aria-pressed={isSaved}
                  className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center hover:bg-white/30 transition-colors"
                >
                  <Bookmark
                    className={isSaved ? 'text-[#FF4D6D]' : 'text-white'}
                    fill={isSaved ? '#FF4D6D' : 'none'}
                  />
                </button>

                <div className="absolute bottom-0 left-0 right-0 px-5 pb-6 pt-12">
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

        <div className="mt-2 sm:mt-4 flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={handleStart}
            className="w-full max-w-md py-4 text-base sm:text-lg font-semibold rounded-full bg-[#FF4D6D] hover:bg-[#FF5F7A] transition-colors shadow-lg"
            disabled={!activeTemplate}
          >
            3분 만에 만들기
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
