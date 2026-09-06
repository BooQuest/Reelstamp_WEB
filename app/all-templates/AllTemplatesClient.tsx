'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bookmark, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/app/components/providers/AuthProvider';
import type { WebApiResponse } from '@/app/lib/api/auth';
import { useSavedTemplates } from '@/app/hooks/useSavedTemplates';
import TemplateMediaPreview from '@/app/components/ui/TemplateMediaPreview';
import TemplateAccessBadge from '@/app/components/ui/TemplateAccessBadge';
import {
  buildTemplateLoginHref,
  canUseTemplate,
  isComingSoonTemplate,
  isGuestTemplateUser,
  isPaidTemplate,
  resolveTemplateAccessType,
  resolveTemplateStatus,
  resolveRestrictedTemplateLoginReturnUrl,
  shouldWaitForPaidTemplateSubscription,
  TEMPLATE_LOGIN_REQUIRED_MESSAGE,
  TEMPLATE_NOT_AVAILABLE_MESSAGE,
  TEMPLATE_PAYMENT_PATH,
  type TemplateAccessType,
  type TemplateStatus,
} from '@/app/lib/templates/access';
import { showAppToast } from '@/app/lib/ui/toast';

type TemplateItem = {
  id: string;
  title: string;
  subtitle: string;
  thumbnailUrl?: string | null;
  embedUrl?: string | null;
  instagramOnly?: boolean;
  tags: string[];
  accessType?: TemplateAccessType | null;
  status?: TemplateStatus | null;
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
  instagramOnly: Boolean(template.instagramOnly),
  tags: Array.isArray(template.tags) ? template.tags : [],
  status: resolveTemplateStatus(template),
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
  const returnUrl = selectedCategoryId
    ? `/all-templates?category=${encodeURIComponent(selectedCategoryId)}`
    : '/all-templates';
  const { savedSet, toggleSave } = useSavedTemplates({ returnUrl });
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const accessRedirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const templateRedirectRef = useRef<string | null>(null);
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

  const showCategoryHome = !selectedCategoryId && !templateIdParam;
  const showTemplateGrid = Boolean(selectedCategoryId) || Boolean(templateIdParam);
  const isTemplateAccessLoading = useCallback(
    (template: TemplateItem | null | undefined) =>
      shouldWaitForPaidTemplateSubscription({
        template,
        isAuthenticated,
        user,
        isLoadingSubscription,
      }),
    [isAuthenticated, isLoadingSubscription, user]
  );

  const redirectToTemplateLogin = useCallback((returnUrl?: string) => {
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
  }, [router]);

  const handleRestrictedPaidTemplate = useCallback((destination?: string) => {
    if (!isAuthenticated || isGuestTemplateUser(user)) {
      redirectToTemplateLogin(resolveRestrictedTemplateLoginReturnUrl(destination));
      return;
    }

    router.push(TEMPLATE_PAYMENT_PATH);
  }, [isAuthenticated, redirectToTemplateLogin, router, user]);

  const ensureTemplateAccess = useCallback((template: TemplateItem, destination?: string) => {
    if (isComingSoonTemplate(template)) {
      return false;
    }
    if (!isPaidTemplate(template)) {
      return true;
    }
    if (isTemplateAccessLoading(template)) {
      return false;
    }
    if (canUseTemplate({ template, isAuthenticated, user, subscription })) {
      return true;
    }

    handleRestrictedPaidTemplate(destination);
    return false;
  }, [
    handleRestrictedPaidTemplate,
    isAuthenticated,
    isTemplateAccessLoading,
    subscription,
    user,
  ]);

  const openTemplateGuideFlow = useCallback(
    (template: TemplateItem) => {
      if (isComingSoonTemplate(template)) {
        showAppToast({
          message: TEMPLATE_NOT_AVAILABLE_MESSAGE,
          tone: 'error',
        });
        return false;
      }

      const destination = buildReelsMakerHref(template.id, returnUrl);
      if (!ensureTemplateAccess(template, destination)) {
        return false;
      }

      router.push(
        isAuthenticated ? destination : `/login?returnUrl=${encodeURIComponent(destination)}`
      );
      return true;
    },
    [ensureTemplateAccess, isAuthenticated, returnUrl, router]
  );

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
    if (!templateIdParam) {
      templateRedirectRef.current = null;
      return;
    }
    if (templateRedirectRef.current === templateIdParam || isLoading) {
      return;
    }

    const template = allTemplates.find((item) => item.id === templateIdParam);
    if (!template || isTemplateAccessLoading(template)) {
      return;
    }

    if (openTemplateGuideFlow(template)) {
      templateRedirectRef.current = templateIdParam;
    }
  }, [
    allTemplates,
    isLoading,
    isTemplateAccessLoading,
    openTemplateGuideFlow,
    templateIdParam,
  ]);

  const handleOpenCategory = (categoryId: string) => {
    router.push(`/all-templates?category=${encodeURIComponent(categoryId)}`);
  };

  const renderTemplateCard = (
    template: TemplateItem,
    options: {
      className: string;
      mediaClassName: string;
      titleClassName: string;
    }
  ) => {
    const isSaved = savedSet.has(template.id);
    const isComingSoon = isComingSoonTemplate(template);
    const isAccessLoading = isTemplateAccessLoading(template);
    const isDisabled = isComingSoon || isAccessLoading;
    const comingSoonTags = template.tags.filter((tag) => tag.trim().length > 0).slice(0, 2);

    return (
      <div key={template.id} className={`group ${options.className}`}>
        <div className="relative">
          <button
            type="button"
            onClick={() => openTemplateGuideFlow(template)}
            disabled={isDisabled}
            className={`${options.mediaClassName} block text-left disabled:cursor-not-allowed ${isAccessLoading ? 'disabled:opacity-60' : ''}`}
            aria-label={
              isComingSoon
                ? `${template.title} 추가 예정 템플릿`
                : `${template.title} 템플릿으로 릴스 만들기`
            }
          >
            {!isComingSoon && (
              <TemplateAccessBadge
                accessType={resolveTemplateAccessType(template)}
                className="absolute left-2 top-2 z-10 sm:left-3 sm:top-3"
              />
            )}
            <TemplateMediaPreview
              title={template.title}
              thumbnailUrl={template.thumbnailUrl}
              embedUrl={template.embedUrl}
              instagramOnly={template.instagramOnly}
              disableEmbedInteraction
              imageClassName={
                isComingSoon
                  ? 'saturate-[0.75]'
                  : 'transition-transform duration-300 group-hover:scale-[1.03]'
              }
            />
            {isComingSoon && (
              <span className="absolute inset-0 bg-black/25" aria-hidden="true" />
            )}
            {isAccessLoading && (
              <span className="absolute inset-x-3 bottom-3 z-10 rounded-full bg-black/55 px-3 py-2 text-center text-xs font-semibold text-white">
                권한 확인 중...
              </span>
            )}
          </button>
          {isComingSoon ? (
            <span className="absolute right-2 top-2 z-20 flex h-9 items-center rounded-full bg-white/90 px-3 text-[11px] font-extrabold text-gray-900 shadow-sm ring-1 ring-black/10 sm:right-3 sm:top-3 sm:text-xs">
              추가 예정
            </span>
          ) : (
            <button
              type="button"
              onClick={() => toggleSave(template)}
              aria-pressed={isSaved}
              aria-label={isSaved ? `${template.title} 저장 취소` : `${template.title} 저장`}
              className="absolute right-2 top-2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur transition hover:bg-black/50 sm:right-3 sm:top-3"
            >
              <Bookmark
                className={`h-4 w-4 ${isSaved ? 'text-[#FF4D6D]' : 'text-white/85'}`}
                fill={isSaved ? '#FF4D6D' : 'none'}
              />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => openTemplateGuideFlow(template)}
          disabled={isDisabled}
          className={`${options.titleClassName} disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {template.title}
        </button>
        {isComingSoon && comingSoonTags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1 sm:mt-2">
            {comingSoonTags.map((tag) => (
              <span
                key={tag}
                className="max-w-full truncate rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold leading-4 text-gray-600 sm:text-xs"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-white">
      <div className="max-w-6xl mx-auto px-3 py-3 sm:px-4 sm:py-10">
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
          <div className="space-y-5 sm:space-y-12">
            {categories.length === 0 && (
              <div className="py-20 text-center text-sm sm:text-base text-gray-500">
                등록된 템플릿 카테고리가 없습니다.
              </div>
            )}

            {categories.map((category) => (
              <section key={category.id} className="min-w-0">
                <div className="mb-2 flex items-center justify-between gap-3 sm:mb-5 sm:gap-4">
                  <button
                    type="button"
                    onClick={() => handleOpenCategory(category.id)}
                    className="group flex min-w-0 items-center gap-2 text-left sm:gap-3"
                  >
                    <h2 className="truncate text-[clamp(14px,4.4vw,17px)] font-extrabold leading-tight text-gray-950 min-[390px]:text-[18px] sm:text-[28px]">
                      {category.title}
                    </h2>
                    <ChevronRight className="h-5 w-5 flex-none text-gray-950 transition-transform group-hover:translate-x-1 sm:h-7 sm:w-7" />
                  </button>
                </div>

                {category.templates.length === 0 ? (
                  <div className="rounded-lg border border-gray-200 px-4 py-8 text-sm text-gray-500">
                    등록된 템플릿이 없습니다.
                  </div>
                ) : (
                  <div className="flex gap-3 overflow-x-auto pb-2 sm:gap-5 sm:pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {category.templates.map((template) =>
                      renderTemplateCard(template, {
                        className:
                          'w-[28vw] min-w-[92px] max-w-[108px] flex-none text-left min-[390px]:max-w-[120px] sm:w-[210px] sm:min-w-[210px] sm:max-w-[220px] md:w-[230px] md:max-w-[230px]',
                        mediaClassName:
                          'relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-gray-100 ring-1 ring-black/5 sm:rounded-2xl',
                        titleClassName:
                          'mt-1 block w-full truncate text-left text-[12px] font-bold leading-tight text-gray-950 min-[390px]:text-[13px] sm:mt-3 sm:text-lg',
                      })
                    )}
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
                {visibleTemplates.map((template) =>
                  renderTemplateCard(template, {
                    className: 'min-w-0 text-left',
                    mediaClassName:
                      'relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 sm:rounded-[28px]',
                    titleClassName:
                      'mt-3 block w-full truncate text-center text-sm font-semibold text-gray-900 sm:text-base',
                  })
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
