'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/app/components/providers/AuthProvider';
import type { WebApiResponse } from '@/app/lib/api/auth';
import { Bookmark, ChevronLeft, ChevronRight, Play, X } from 'lucide-react';
import { useSavedTemplates } from '@/app/hooks/useSavedTemplates';
import TemplateMediaPreview from '@/app/components/ui/TemplateMediaPreview';
import TemplateAccessBadge from '@/app/components/ui/TemplateAccessBadge';
import {
  buildTemplateLoginHref,
  canUseTemplate,
  isGuestTemplateUser,
  isPaidTemplate,
  resolveTemplateAccessType,
  TEMPLATE_LOGIN_REQUIRED_MESSAGE,
  TEMPLATE_PAYMENT_PATH,
  type TemplateAccessType,
} from '@/app/lib/templates/access';
import { showAppToast } from '@/app/lib/ui/toast';

type TemplateItem = {
  id: string;
  title: string;
  subtitle: string;
  thumbnailUrl?: string | null;
  embedUrl?: string | null;
  tags: string[];
  accessType?: TemplateAccessType | null;
};

type TemplateCategory = {
  id: string;
  title: string;
  description?: string | null;
  displayOrder: number;
  templates: TemplateItem[];
};

type TemplateCategoryListResponse = {
  categories: TemplateCategory[];
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const normalizeTemplate = (template: TemplateItem): TemplateItem => ({
  ...template,
  subtitle: template.subtitle ?? '',
  thumbnailUrl: template.thumbnailUrl?.trim() || null,
  embedUrl: template.embedUrl ?? null,
  tags: Array.isArray(template.tags) ? template.tags : [],
});

const normalizeCategory = (category: TemplateCategory): TemplateCategory => ({
  ...category,
  description: category.description ?? null,
  displayOrder: category.displayOrder ?? 0,
  templates: (category.templates ?? []).map(normalizeTemplate),
});

const buildReelsMakerHref = (templateId: string, returnUrl: string) =>
  `/reels-maker?templateId=${encodeURIComponent(templateId)}&returnUrl=${encodeURIComponent(returnUrl)}`;

export default function AllTemplatesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, user, subscription, isLoadingSubscription } = useAuth();
  const selectedCategoryId = searchParams.get('category');
  const templateIdParam = searchParams.get('templateId');
  const returnUrl = templateIdParam
    ? `/all-templates?templateId=${encodeURIComponent(templateIdParam)}`
    : selectedCategoryId
    ? `/all-templates?category=${encodeURIComponent(selectedCategoryId)}`
    : '/all-templates';
  const { savedSet, toggleSave } = useSavedTemplates({ returnUrl });
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [activeModalCategoryId, setActiveModalCategoryId] = useState<string | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const accessRedirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showSelectTemplateBanner = searchParams.get('reason') === 'select-template';

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId]
  );

  const allTemplates = useMemo(() => {
    const templatesById = new Map<string, TemplateItem>();
    categories.forEach((category) => {
      category.templates.forEach((template) => {
        if (!templatesById.has(template.id)) {
          templatesById.set(template.id, template);
        }
      });
    });
    return Array.from(templatesById.values());
  }, [categories]);

  const visibleTemplates = useMemo(() => {
    if (selectedCategory) {
      return selectedCategory.templates;
    }
    if (templateIdParam) {
      return allTemplates;
    }
    return [];
  }, [allTemplates, selectedCategory, templateIdParam]);

  const activeModalCategory = useMemo(
    () => categories.find((category) => category.id === activeModalCategoryId) ?? null,
    [activeModalCategoryId, categories]
  );

  const modalTemplates = activeModalCategory?.templates ?? visibleTemplates;

  const activeTemplate = useMemo(
    () => (activeIndex === null ? null : modalTemplates[activeIndex] ?? null),
    [activeIndex, modalTemplates]
  );

  const showCategoryHome = !selectedCategoryId && !templateIdParam;
  const showTemplateGrid = Boolean(selectedCategoryId) || Boolean(templateIdParam);
  const isTemplateAccessLoading = useCallback(
    (template: TemplateItem | null | undefined) =>
      Boolean(
        template &&
          isPaidTemplate(template) &&
          isAuthenticated &&
          !isGuestTemplateUser(user) &&
          isLoadingSubscription
      ),
    [isAuthenticated, isLoadingSubscription, user]
  );

  const redirectToTemplateLogin = useCallback(() => {
    showAppToast({
      message: TEMPLATE_LOGIN_REQUIRED_MESSAGE,
      tone: 'error',
    });
    if (accessRedirectTimerRef.current) {
      clearTimeout(accessRedirectTimerRef.current);
    }
    accessRedirectTimerRef.current = setTimeout(() => {
      router.push(buildTemplateLoginHref());
    }, 800);
  }, [router]);

  const handleRestrictedPaidTemplate = useCallback(() => {
    if (!isAuthenticated || isGuestTemplateUser(user)) {
      redirectToTemplateLogin();
      return;
    }

    router.push(TEMPLATE_PAYMENT_PATH);
  }, [isAuthenticated, redirectToTemplateLogin, router, user]);

  const ensureTemplateAccess = useCallback((template: TemplateItem) => {
    if (!isPaidTemplate(template)) {
      return true;
    }
    if (isTemplateAccessLoading(template)) {
      return false;
    }
    if (canUseTemplate({ template, isAuthenticated, user, subscription })) {
      return true;
    }

    handleRestrictedPaidTemplate();
    return false;
  }, [
    handleRestrictedPaidTemplate,
    isAuthenticated,
    isTemplateAccessLoading,
    subscription,
    user,
  ]);

  useEffect(() => {
    let isMounted = true;

    const loadCategories = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await fetch('/api/templates/categories', {
          method: 'GET',
          cache: 'no-store',
        });

        const payload: WebApiResponse<TemplateCategoryListResponse> = await response.json();

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || '템플릿 카테고리 목록을 불러오지 못했습니다.');
        }

        const normalized = (payload.data?.categories ?? [])
          .map(normalizeCategory)
          .sort((a, b) => a.displayOrder - b.displayOrder);

        if (isMounted) {
          setCategories(normalized);
        }
      } catch (error: unknown) {
        if (isMounted) {
          setLoadError(getErrorMessage(error, '템플릿 카테고리 목록을 불러오지 못했습니다.'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadCategories();

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

  useEffect(() => {
    if (activeIndex === null) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [activeIndex]);

  useEffect(() => {
    if (activeIndex === null) {
      return;
    }

    if (modalTemplates.length === 0 || activeIndex >= modalTemplates.length) {
      setActiveIndex(null);
      setActiveModalCategoryId(null);
    }
  }, [modalTemplates.length, activeIndex]);

  useEffect(() => {
    if (!templateIdParam || visibleTemplates.length === 0) {
      return;
    }

    const index = visibleTemplates.findIndex((template) => template.id === templateIdParam);
    if (index >= 0) {
      const template = visibleTemplates[index];
      if (!ensureTemplateAccess(template)) {
        return;
      }
      setActiveIndex(index);
    }
  }, [ensureTemplateAccess, templateIdParam, visibleTemplates]);

  useEffect(() => {
    if (!templateIdParam) {
      setActiveIndex(null);
    }
  }, [selectedCategoryId, templateIdParam]);

  const handleOpenCategory = (categoryId: string) => {
    router.push(`/all-templates?category=${encodeURIComponent(categoryId)}`);
  };

  const handleOpenTemplatePreview = (categoryId: string, templateId: string) => {
    const category = categories.find((item) => item.id === categoryId);
    const templateIndex = category?.templates.findIndex((template) => template.id === templateId) ?? -1;
    if (!category || templateIndex < 0) {
      return;
    }
    const template = category.templates[templateIndex];
    if (!ensureTemplateAccess(template)) {
      return;
    }

    setActiveModalCategoryId(categoryId);
    setActiveIndex(templateIndex);
  };

  const handleCreate = () => {
    if (activeIndex === null || !activeTemplate) {
      return;
    }

    const destination = buildReelsMakerHref(activeTemplate.id, returnUrl);
    if (!ensureTemplateAccess(activeTemplate)) {
      return;
    }
    router.push(
      isAuthenticated ? destination : `/login?returnUrl=${encodeURIComponent(destination)}`
    );
  };

  const handlePrev = () => {
    setActiveIndex((prev) => {
      if (prev === null) {
        return 0;
      }
      return Math.max(0, prev - 1);
    });
  };

  const handleNext = () => {
    setActiveIndex((prev) => {
      if (prev === null) {
        return 0;
      }
      return Math.min(modalTemplates.length - 1, prev + 1);
    });
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

  const handleCloseModal = () => {
    setActiveIndex(null);
    setActiveModalCategoryId(null);
    swipeStartRef.current = null;
    if (templateIdParam) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('templateId');
      const query = params.toString();
      router.replace(query ? `/all-templates?${query}` : '/all-templates');
    }
  };

  const getCardStyle = (index: number) => {
    if (activeIndex === null) {
      return {};
    }

    const delta = index - activeIndex;
    const distance = Math.abs(delta);

    if (distance === 0) {
      return {
        zIndex: 30,
        opacity: 1,
        filter: 'brightness(1)',
        transform: 'translate(-50%, -50%) translateX(0%) translateY(0px) scale(1)',
        pointerEvents: 'auto' as const,
      };
    }

    if (distance > 2) {
      return {
        zIndex: 10,
        opacity: 0,
        filter: 'brightness(0.6)',
        transform: 'translate(-50%, -50%) scale(0.82)',
        pointerEvents: 'none' as const,
      };
    }

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

  return (
    <div className="min-h-[calc(100vh-80px)] bg-white">
      <div className="max-w-6xl mx-auto px-4 py-5 sm:py-10">
        {showSelectTemplateBanner && (
          <div className="mb-6 rounded-2xl border border-rose-200/60 bg-white px-4 py-3 text-sm sm:text-base text-rose-500 shadow-sm">
            템플릿을 먼저 선택해주세요.
          </div>
        )}

        {isLoading && (
          <div className="py-20 text-center text-sm sm:text-base text-gray-500">
            템플릿 카테고리를 불러오는 중입니다...
          </div>
        )}

        {!isLoading && loadError && (
          <div className="py-20 text-center text-sm sm:text-base text-rose-500">
            {loadError}
          </div>
        )}

        {!isLoading && !loadError && showCategoryHome && (
          <div className="space-y-8 sm:space-y-12">
            {categories.length === 0 && (
              <div className="py-20 text-center text-sm sm:text-base text-gray-500">
                등록된 템플릿 카테고리가 없습니다.
              </div>
            )}

            {categories.map((category) => (
              <section key={category.id} className="min-w-0">
                <div className="mb-3 flex items-center justify-between gap-4 sm:mb-5">
                  <button
                    type="button"
                    onClick={() => handleOpenCategory(category.id)}
                    className="group flex min-w-0 items-center gap-3 text-left"
                  >
                    <h2 className="truncate text-[22px] font-extrabold leading-tight text-gray-950 sm:text-[28px]">
                      {category.title}
                    </h2>
                    <ChevronRight className="h-6 w-6 flex-none text-gray-950 transition-transform group-hover:translate-x-1 sm:h-7 sm:w-7" />
                  </button>
                </div>

                {category.templates.length === 0 ? (
                  <div className="rounded-lg border border-gray-200 px-4 py-8 text-sm text-gray-500">
                    등록된 템플릿이 없습니다.
                  </div>
                ) : (
                  <div className="flex gap-3 overflow-x-auto pb-2 sm:gap-5 sm:pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {category.templates.map((template) => (
                      <button
                        key={`${category.id}-${template.id}`}
                        type="button"
                        onClick={() => handleOpenTemplatePreview(category.id, template.id)}
                        className="group w-[31vw] min-w-[112px] max-w-[132px] flex-none text-left sm:w-[210px] sm:min-w-[210px] sm:max-w-[220px] md:w-[230px] md:max-w-[230px]"
                      >
                        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-gray-100 ring-1 ring-black/5 sm:rounded-2xl">
                          <TemplateAccessBadge
                            accessType={resolveTemplateAccessType(template)}
                            className="absolute left-2 top-2 z-10"
                          />
                          <TemplateMediaPreview
                            title={template.title}
                            thumbnailUrl={template.thumbnailUrl}
                            embedUrl={template.embedUrl}
                            disableEmbedInteraction
                            imageClassName="transition-transform duration-300 group-hover:scale-[1.03]"
                          />
                        </div>
                        <h3 className="mt-2 truncate text-sm font-bold text-gray-950 sm:mt-3 sm:text-lg">
                          {template.title}
                        </h3>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}

        {!isLoading && !loadError && showTemplateGrid && (
          <>
            <div className="mb-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push('/all-templates')}
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50"
                aria-label="카테고리 목록으로 돌아가기"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h1 className="min-w-0 truncate text-[22px] font-extrabold leading-tight text-gray-950 sm:text-[28px]">
                {selectedCategory?.title ?? '릴스 템플릿'}
              </h1>
            </div>

            {selectedCategoryId && !selectedCategory && (
              <div className="py-20 text-center text-sm sm:text-base text-gray-500">
                카테고리를 찾을 수 없습니다.
              </div>
            )}

            {(!selectedCategoryId || selectedCategory) && visibleTemplates.length === 0 && (
              <div className="py-20 text-center text-sm sm:text-base text-gray-500">
                등록된 템플릿이 없습니다.
              </div>
            )}

            {(!selectedCategoryId || selectedCategory) && visibleTemplates.length > 0 && (
              <div className="grid grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                {visibleTemplates.map((template, index) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => {
                      if (!ensureTemplateAccess(template)) {
                        return;
                      }
                      setActiveModalCategoryId(null);
                      setActiveIndex(index);
                    }}
                    className="group text-left"
                  >
                    <div className="relative w-full aspect-[3/4] rounded-2xl sm:rounded-[28px] overflow-hidden bg-white shadow-sm ring-1 ring-black/5">
                      <TemplateAccessBadge
                        accessType={resolveTemplateAccessType(template)}
                        className="absolute left-2 top-2 z-10 sm:left-3 sm:top-3"
                      />
                      <TemplateMediaPreview
                        title={template.title}
                        thumbnailUrl={template.thumbnailUrl}
                        embedUrl={template.embedUrl}
                        disableEmbedInteraction
                        imageClassName="transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    </div>
                    <div className="mt-3 text-center">
                      <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                        {template.title}
                      </h3>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {activeTemplate && (
        <div
          className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm"
          onClick={handleCloseModal}
        >
          <div
            className="absolute inset-0"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={handleCloseModal}
              className="absolute right-5 top-5 z-[90] flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-6 sm:top-6"
              aria-label="닫기"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex h-full flex-col items-center justify-center overflow-hidden px-0 py-8 sm:py-10">
              <div
                className="relative flex h-[390px] max-h-[60vh] w-full touch-pan-y select-none items-center justify-center overflow-hidden overscroll-x-none pb-2 sm:h-[500px] sm:max-h-[62vh] sm:pb-3 md:h-[520px] lg:h-[540px]"
                onPointerDown={handleCarouselPointerDown}
                onPointerUp={handleCarouselPointerUp}
                onPointerCancel={handleCarouselPointerCancel}
              >
                {modalTemplates.map((template, index) => {
                  const isActive = index === activeIndex;
                  return (
                    <div
                      key={template.id}
                      className="absolute left-1/2 top-1/2 w-[78vw] max-w-[360px] sm:w-[320px] lg:w-[360px] aspect-[3/4] rounded-[28px] overflow-hidden shadow-2xl transition-all duration-500 ease-out"
                      style={getCardStyle(index)}
                      aria-hidden={!isActive}
                    >
                      <TemplateMediaPreview
                        title={template.title}
                        thumbnailUrl={template.thumbnailUrl}
                        embedUrl={template.embedUrl}
                        disableEmbedInteraction={!isActive}
                        preferEmbed
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/80" />
                      <TemplateAccessBadge
                        accessType={resolveTemplateAccessType(template)}
                        className="pointer-events-none absolute left-4 top-4 z-40"
                      />

                      {!template.embedUrl && (
                        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-white">
                          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                            <Play className="w-5 h-5" />
                          </div>
                          <span className="mt-2 text-xs font-semibold tracking-wide">임베드 준비중</span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => toggleSave(template)}
                        aria-pressed={savedSet.has(template.id)}
                        className="absolute top-4 right-4 z-40 w-10 h-10 rounded-full bg-white/15 backdrop-blur flex items-center justify-center hover:bg-white/25 transition-colors"
                      >
                        <Bookmark
                          className={savedSet.has(template.id) ? 'text-[#FF4D6D]' : 'text-white/80'}
                          fill={savedSet.has(template.id) ? '#FF4D6D' : 'none'}
                        />
                      </button>

                      <div className="pointer-events-none absolute bottom-0 left-0 right-0 px-5 pb-6 pt-10">
                        <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 drop-shadow-lg">
                          {template.title}
                        </h3>
                        <p className="text-sm text-white/80 mb-4 leading-relaxed line-clamp-2">
                          {template.subtitle}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {template.tags.map((tag) => (
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
                {activeIndex !== null && modalTemplates.length > 1 && activeIndex > 0 && (
                  <button
                    type="button"
                    onClick={handlePrev}
                    onPointerDown={(event) => event.stopPropagation()}
                    onPointerUp={(event) => event.stopPropagation()}
                    aria-label="이전 템플릿"
                    className="absolute left-4 top-1/2 z-50 -translate-y-1/2 w-11 h-11 rounded-full bg-[#FF4D6D] shadow-lg flex items-center justify-center hover:scale-105 transition-transform sm:left-8"
                  >
                    <ChevronLeft className="w-5 h-5 text-white" />
                  </button>
                )}
                {activeIndex !== null && modalTemplates.length > 1 && activeIndex < modalTemplates.length - 1 && (
                  <button
                    type="button"
                    onClick={handleNext}
                    onPointerDown={(event) => event.stopPropagation()}
                    onPointerUp={(event) => event.stopPropagation()}
                    aria-label="다음 템플릿"
                    className="absolute right-4 top-1/2 z-50 -translate-y-1/2 w-11 h-11 rounded-full bg-[#FF4D6D] shadow-lg flex items-center justify-center hover:scale-105 transition-transform sm:right-8"
                  >
                    <ChevronRight className="w-5 h-5 text-white" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleCreate}
                disabled={isTemplateAccessLoading(activeTemplate)}
                className="mt-4 block w-[calc(100%-3rem)] max-w-md rounded-full bg-[#FF4E73] py-4 text-base font-semibold text-white shadow-lg shadow-pink-500/30 transition hover:brightness-105 disabled:cursor-not-allowed disabled:bg-white/20 disabled:shadow-none sm:text-lg"
              >
                {isTemplateAccessLoading(activeTemplate) ? '권한 확인 중...' : '3분 만에 만들기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
