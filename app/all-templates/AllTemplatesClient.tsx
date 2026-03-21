'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/components/providers/AuthProvider';
import InstagramEmbed from '@/app/components/ui/InstagramEmbed';
import { Bookmark, ChevronLeft, ChevronRight, Play, X } from 'lucide-react';

type TemplateItem = {
  id: string;
  title: string;
  subtitle: string;
  thumbnailUrl: string;
  embedUrl?: string | null;
  tags: string[];
};

const templates: TemplateItem[] = [
  {
    id: 'tpl-1',
    title: '고객 인터뷰 스타일',
    subtitle: '실제 고객 후기 기반, 신뢰를 높이는 인터뷰 템플릿',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=900&q=80',
    tags: ['고객후기', '신뢰감'],
  },
  {
    id: 'tpl-2',
    title: '비하인드 스토리',
    subtitle: '제작 과정과 현장 분위기를 자연스럽게 담는 템플릿',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80',
    tags: ['비하인드', '일상'],
  },
  {
    id: 'tpl-3',
    title: 'Before & After',
    subtitle: '변화의 대비로 임팩트를 강조하는 전후 비교 템플릿',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=900&q=80',
    tags: ['변화', '임팩트'],
  },
  {
    id: 'tpl-4',
    title: '제품 리뷰',
    subtitle: '사용 후기를 빠르게 전달하는 핵심 포인트 중심',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=900&q=80',
    tags: ['리뷰', '정보'],
  },
  {
    id: 'tpl-5',
    title: '튜토리얼 가이드',
    subtitle: '짧고 명확한 단계별 사용법 가이드 템플릿',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=900&q=80',
    tags: ['가이드', '튜토리얼'],
  },
  {
    id: 'tpl-6',
    title: '프로모션 안내',
    subtitle: '행사/프로모션을 강조하는 시각적 템플릿',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=900&q=80',
    tags: ['프로모션', '공지'],
  },
  {
    id: 'tpl-7',
    title: '일상 브이로그',
    subtitle: '가볍게 브랜드 일상을 공유하는 스토리형 템플릿',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&q=80',
    tags: ['일상', '브이로그'],
  },
  {
    id: 'tpl-8',
    title: 'Q&A 인터랙티브',
    subtitle: '질문/답변을 중심으로 신뢰를 쌓는 템플릿',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=900&q=80',
    tags: ['Q&A', '소통'],
  },
  {
    id: 'tpl-9',
    title: '공간 소개',
    subtitle: '공간의 매력을 보여주는 시네마틱 템플릿',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=900&q=80',
    tags: ['공간', '소개'],
  },
];

export default function AllTemplatesClient() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const activeTemplate = useMemo(
    () => (activeIndex === null ? null : templates[activeIndex]),
    [activeIndex]
  );

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
        <div className="grid grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {templates.map((template, index) => (
            <button
              key={template.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              className="group text-left"
            >
              <div className="relative w-full aspect-[3/4] rounded-2xl sm:rounded-[28px] overflow-hidden bg-white shadow-sm ring-1 ring-black/5">
                <Image
                  src={template.thumbnailUrl}
                  alt={template.title}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
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
          onClick={() => setActiveIndex(null)}
        >
          <div
            className="absolute inset-0 flex flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-end px-6 pt-6">
              <button
                type="button"
                onClick={() => setActiveIndex(null)}
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
                      {template.embedUrl ? (
                        <div className="absolute inset-0">
                          <InstagramEmbed url={template.embedUrl} className="h-full w-full rounded-none" />
                        </div>
                      ) : (
                        <div className="absolute inset-0">
                          <Image
                            src={template.thumbnailUrl}
                            alt={template.title}
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/80" />

                      {!template.embedUrl && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                            <Play className="w-5 h-5" />
                          </div>
                          <span className="mt-2 text-xs font-semibold tracking-wide">임베드 준비중</span>
                        </div>
                      )}

                      <div className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 backdrop-blur flex items-center justify-center">
                        <Bookmark className="w-5 h-5 text-white/80" />
                      </div>

                      {isActive && (
                        <>
                          {activeIndex !== null && activeIndex > 0 && (
                            <button
                              type="button"
                              onClick={handlePrev}
                              aria-label="이전 템플릿"
                              className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-[#FF4D6D] shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
                            >
                              <ChevronLeft className="w-5 h-5 text-white" />
                            </button>
                          )}
                          {activeIndex !== null && activeIndex < templates.length - 1 && (
                            <button
                              type="button"
                              onClick={handleNext}
                              aria-label="다음 템플릿"
                              className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-[#FF4D6D] shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
                            >
                              <ChevronRight className="w-5 h-5 text-white" />
                            </button>
                          )}
                        </>
                      )}

                      <div className="absolute bottom-0 left-0 right-0 px-5 pb-6 pt-10">
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
