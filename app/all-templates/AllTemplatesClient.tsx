'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/app/components/providers/AuthProvider';
import type { WebApiResponse } from '@/app/lib/api/auth';
import { Bookmark, ChevronLeft, ChevronRight, Play, X } from 'lucide-react';
import { useSavedTemplates } from '@/app/hooks/useSavedTemplates';
import TemplateMediaPreview from '@/app/components/ui/TemplateMediaPreview';

type TemplateItem = {
  id: string;
  title: string;
  subtitle: string;
  thumbnailUrl?: string | null;
  embedUrl?: string | null;
  tags: string[];
};

type TemplateListResponse = {
  templates: TemplateItem[];
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export default function AllTemplatesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();
  const { savedSet, toggleSave } = useSavedTemplates({ returnUrl: '/all-templates' });
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const showSelectTemplateBanner = searchParams.get('reason') === 'select-template';
  const templateIdParam = searchParams.get('templateId');

  const activeTemplate = useMemo(
    () => (activeIndex === null ? null : templates[activeIndex] ?? null),
    [activeIndex, templates]
  );

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
    if (templates.length === 0) {
      if (activeIndex !== null) {
        setActiveIndex(null);
      }
      return;
    }

    if (activeIndex !== null && activeIndex >= templates.length) {
      setActiveIndex(null);
    }
  }, [templates.length, activeIndex]);

  useEffect(() => {
    if (!templateIdParam || templates.length === 0) {
      return;
    }

    const index = templates.findIndex((template) => template.id === templateIdParam);
    if (index >= 0) {
      setActiveIndex(index);
    }
  }, [templateIdParam, templates]);

  const handleCreate = () => {
    if (activeIndex === null || !activeTemplate) {
      return;
    }

    const destination = `/reels-maker?templateId=${activeTemplate.id}`;
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
      return Math.min(templates.length - 1, prev + 1);
    });
  };

  const handleCloseModal = () => {
    setActiveIndex(null);
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
    <div className="min-h-[calc(100vh-80px)] bg-[#FFF6FA]">
      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-10">
        {showSelectTemplateBanner && (
          <div className="mb-6 rounded-2xl border border-rose-200/60 bg-white px-4 py-3 text-sm sm:text-base text-rose-500 shadow-sm">
            템플릿을 먼저 선택해주세요.
          </div>
        )}
        <div className="grid grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {isLoading && (
            <div className="col-span-3 py-20 text-center text-sm sm:text-base text-gray-500">
              템플릿을 불러오는 중입니다...
            </div>
          )}
          {!isLoading && loadError && (
            <div className="col-span-3 py-20 text-center text-sm sm:text-base text-rose-500">
              {loadError}
            </div>
          )}
          {!isLoading && !loadError && templates.length === 0 && (
            <div className="col-span-3 py-20 text-center text-sm sm:text-base text-gray-500">
              등록된 템플릿이 없습니다.
            </div>
          )}
          {!isLoading &&
            !loadError &&
            templates.map((template, index) => (
              <button
                key={template.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                className="group text-left"
              >
                <div className="relative w-full aspect-[3/4] rounded-2xl sm:rounded-[28px] overflow-hidden bg-white shadow-sm ring-1 ring-black/5">
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
      </div>

      {activeTemplate && (
        <div
          className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm"
          onClick={handleCloseModal}
        >
          <div
            className="absolute inset-0 flex flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-end px-6 pt-6">
              <button
                type="button"
                onClick={handleCloseModal}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
                aria-label="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-hidden">
              <div
                className="relative w-full flex items-center justify-center h-[520px] sm:h-[560px] md:h-[600px] pb-6 sm:pb-8"
              >
                {templates.map((template, index) => {
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

                      {isActive && (
                        <>
                          {activeIndex !== null && activeIndex > 0 && (
                            <button
                              type="button"
                              onClick={handlePrev}
                              aria-label="이전 템플릿"
                              className="absolute left-4 top-1/2 z-40 -translate-y-1/2 w-11 h-11 rounded-full bg-[#FF4D6D] shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
                            >
                              <ChevronLeft className="w-5 h-5 text-white" />
                            </button>
                          )}
                          {activeIndex !== null && activeIndex < templates.length - 1 && (
                            <button
                              type="button"
                              onClick={handleNext}
                              aria-label="다음 템플릿"
                              className="absolute right-4 top-1/2 z-40 -translate-y-1/2 w-11 h-11 rounded-full bg-[#FF4D6D] shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
                            >
                              <ChevronRight className="w-5 h-5 text-white" />
                            </button>
                          )}
                        </>
                      )}

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
              </div>
            </div>

            <div className="px-6 pb-8">
              <button
                type="button"
                onClick={handleCreate}
                className="w-full max-w-md mx-auto block rounded-full bg-[#FF4E73] text-white text-base sm:text-lg font-semibold py-4 shadow-lg shadow-pink-500/30 hover:brightness-105 transition"
              >
                3분 만에 만들기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
