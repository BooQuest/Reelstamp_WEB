'use client';
import { useUiLocale, useUiText } from '@/app/i18n/LocaleProvider';


import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bookmark, ChevronLeft, ChevronRight } from 'lucide-react';
import type { WebApiResponse } from '@/app/lib/api/auth';
import { useSavedTemplates, type TemplateSummary } from '@/app/hooks/useSavedTemplates';
import TemplatePreviewModal, { type TemplatePreviewSelection } from '@/app/components/features/templates/TemplatePreviewModal';
import TemplateMediaPreview from '@/app/components/ui/TemplateMediaPreview';
import TemplateAccessBadge from '@/app/components/ui/TemplateAccessBadge';
import useOnboarding from '@/app/components/onboarding/useOnboarding';
import {
  isComingSoonTemplate,
  resolveTemplateAccessType,
  resolveTemplateStatus,
  TEMPLATE_NOT_AVAILABLE_MESSAGE,
} from '@/app/lib/templates/access';

type TemplateItem = TemplateSummary;

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

export default function AllTemplatesClient() {
  const { locale } = useUiLocale();
  const t = useUiText();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedCategoryId = searchParams.get('category');
  const templateIdParam = searchParams.get('templateId');
  const returnUrl = selectedCategoryId
    ? `/all-templates?category=${encodeURIComponent(selectedCategoryId)}`
    : '/all-templates';
  const { savedSet, toggleSave, error: saveError } = useSavedTemplates({ returnUrl });
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const pageKey = searchParams.toString();
  const { status: onboardingStatus } = useOnboarding();
  const [previewState, setPreviewState] = useState<{
    pageKey: string;
    selection: TemplatePreviewSelection | null;
    dismissedLink: boolean;
  }>({ pageKey, selection: null, dismissedLink: false });
  // Query navigation starts a new browsing context, including returning to a previously closed link.
  if (previewState.pageKey !== pageKey) {
    setPreviewState({ pageKey, selection: null, dismissedLink: false });
  }
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
    if (selectedCategoryId) {
      return selectedCategory?.templates ?? [];
    }
    if (templateIdParam) {
      return allTemplates;
    }
    return [];
  }, [allTemplates, selectedCategory, selectedCategoryId, templateIdParam]);

  const showCategoryHome = !selectedCategoryId && !templateIdParam;
  const showTemplateGrid = Boolean(selectedCategoryId) || Boolean(templateIdParam);
  const linkedTemplate = templateIdParam ? visibleTemplates.find(template => template.id === templateIdParam) : null;
  const linkError = !isLoading && !loadError && templateIdParam && (!linkedTemplate || isComingSoonTemplate(linkedTemplate))
    ? linkedTemplate ? TEMPLATE_NOT_AVAILABLE_MESSAGE : '템플릿을 찾을 수 없습니다.'
    : null;
  const activePreview = previewState.selection ?? (
    templateIdParam && linkedTemplate && !isComingSoonTemplate(linkedTemplate) && !previewState.dismissedLink && onboardingStatus?.entranceCompleted
      ? { templates: visibleTemplates, initialTemplateId: templateIdParam }
      : null
  );

  const openPreview = (template: TemplateItem, templates: TemplateItem[]) => {
    if (isComingSoonTemplate(template)) return;
    setPreviewState({ pageKey, selection: { templates: [...templates], initialTemplateId: template.id }, dismissedLink: false });
  };

  const closePreview = () => {
    setPreviewState({ pageKey, selection: null, dismissedLink: true });
    if (templateIdParam) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('templateId');
      const query = params.toString();
      router.replace(query ? `/all-templates?${query}` : '/all-templates', { scroll: false });
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadCategories = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await fetch(`/api/templates/categories${locale === 'en' ? '?locale=en' : ''}`, {
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
  }, [locale]);

  const handleOpenCategory = (categoryId: string) => {
    router.push(`/all-templates?category=${encodeURIComponent(categoryId)}`);
  };

  const renderTemplateCard = (
    template: TemplateItem,
    templates: TemplateItem[],
    options: {
      className: string;
      mediaClassName: string;
      titleClassName: string;
      showComingSoonTags?: boolean;
    }
  ) => {
    const isSaved = savedSet.has(template.id);
    const isComingSoon = isComingSoonTemplate(template);
    const isDisabled = isComingSoon;
    const comingSoonTags = template.tags.filter((tag) => tag.trim().length > 0).slice(0, 2);

    return (
      <div key={template.id} className={`group ${options.className}`}>
        <div className="relative">
          <button
            type="button"
            onClick={() => openPreview(template, templates)}
            disabled={isDisabled}
            className={`${options.mediaClassName} block text-left disabled:cursor-not-allowed`}
            aria-label={
              t(isComingSoon
                ? `${template.title} 추가 예정 템플릿`
                : `${template.title} 상세 보기`)
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
          </button>
          {isComingSoon ? (
            <span className="absolute right-2 top-2 z-20 flex h-9 items-center rounded-full bg-white/90 px-3 text-[11px] font-extrabold text-gray-900 shadow-sm ring-1 ring-black/10 sm:right-3 sm:top-3 sm:text-xs">
              {t("추가 예정")}</span>
          ) : (
            <button
              type="button"
              onClick={() => toggleSave(template)}
              aria-pressed={isSaved}
              aria-label={t.format(isSaved ? '{v0} 저장 취소' : '{v0} 저장', {v0: template.title})}
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
          onClick={() => openPreview(template, templates)}
          disabled={isDisabled}
          className={`${options.titleClassName} disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {template.title}
        </button>
        {isComingSoon && options.showComingSoonTags !== false && comingSoonTags.length > 0 && (
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
            {t("템플릿을 먼저 선택해주세요.")}</div>
        )}

        {(linkError || (saveError && !activePreview)) && (
          <p role="alert" className="mb-4 text-sm text-rose-500">{t(linkError || saveError)}</p>
        )}

        {isLoading && (
          <div className="py-20 text-center text-sm sm:text-base text-gray-500">
            {t("템플릿 카테고리를 불러오는 중입니다...")}</div>
        )}

        {!isLoading && loadError && (
          <div className="py-20 text-center text-sm sm:text-base text-rose-500">
            {t(loadError)}
          </div>
        )}

        {!isLoading && !loadError && showCategoryHome && (
          <div className="space-y-5 sm:space-y-12">
            {categories.length === 0 && (
              <div className="py-20 text-center text-sm sm:text-base text-gray-500">
                {t(locale === "en" ? "영어 템플릿을 준비하고 있습니다." : "등록된 템플릿 카테고리가 없습니다.")}</div>
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
                    {t(locale === "en" ? "영어 템플릿을 준비하고 있습니다." : "등록된 템플릿이 없습니다.")}</div>
                ) : (
                  <div className="flex gap-3 overflow-x-auto pb-2 sm:gap-5 sm:pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {category.templates.map((template) =>
                      renderTemplateCard(template, category.templates, {
                        className:
                          'w-[28vw] min-w-[92px] max-w-[108px] flex-none text-left min-[390px]:max-w-[120px] sm:w-[210px] sm:min-w-[210px] sm:max-w-[220px] md:w-[230px] md:max-w-[230px]',
                        mediaClassName:
                          'relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-gray-100 ring-1 ring-black/5 sm:rounded-2xl',
                        titleClassName:
                          'mt-1 block w-full truncate text-left text-[12px] font-bold leading-tight text-gray-950 min-[390px]:text-[13px] sm:mt-3 sm:text-lg',
                        showComingSoonTags: false,
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
                aria-label={t("카테고리 목록으로 돌아가기")}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h1 className="min-w-0 truncate text-[22px] font-extrabold leading-tight text-gray-950 sm:text-[28px]">
                {selectedCategory?.title ?? t('릴스 템플릿')}
              </h1>
            </div>

            {selectedCategoryId && !selectedCategory && (
              <div className="py-20 text-center text-sm sm:text-base text-gray-500">
                {t("카테고리를 찾을 수 없습니다.")}</div>
            )}

            {(!selectedCategoryId || selectedCategory) && visibleTemplates.length === 0 && (
              <div className="py-20 text-center text-sm sm:text-base text-gray-500">
                {t(locale === "en" ? "영어 템플릿을 준비하고 있습니다." : "등록된 템플릿이 없습니다.")}</div>
            )}

            {(!selectedCategoryId || selectedCategory) && visibleTemplates.length > 0 && (
              <div className="grid grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                {visibleTemplates.map((template) =>
                  renderTemplateCard(template, visibleTemplates, {
                    className: 'min-w-0 text-left',
                    mediaClassName:
                      'relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 sm:rounded-[28px]',
                    titleClassName:
                      'mt-3 block w-full truncate text-center text-sm font-semibold text-gray-900 sm:text-base',
                    // TODO: Remove this override once this template's functionality is ready. Keep its stored tags intact.
                    showComingSoonTags: template.id !== 'tpl-work-clothes-vs-weekend-1',
                  })
                )}
              </div>
            )}
          </>
        )}
      </div>
      {activePreview && (
        <TemplatePreviewModal
          key={`${pageKey}:${activePreview.initialTemplateId}`}
          {...activePreview}
          returnUrl={returnUrl}
          savedSet={savedSet}
          saveError={saveError}
          onToggleSave={toggleSave}
          onClose={closePreview}
        />
      )}
    </div>
  );
}
