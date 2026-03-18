'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bookmark, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/app/components/providers/AuthProvider';

const STORAGE_KEY = 'reelstamp.savedTrends';

const trendCards = [
  {
    id: 'trend-1',
    badge: '추천 1',
    title: '고객 인터뷰 스타일',
    description:
      '실제 고객 후기와 반응을 담아 신뢰도 UP! “여기 진짜 맛있어요~” 스타일의 바이럴 템플릿',
    tags: ['고객후기', '신뢰감', 'MZ추천'],
    image:
      'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'trend-2',
    badge: '추천 2',
    title: '비하인드 스토리',
    description:
      '평소 못 본 비하인드 공개! 직원들의 일상과 제품 제작 과정을 보여주기 좋은 템플릿',
    tags: ['비하인드', '친근함', '일상'],
    image:
      'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'trend-3',
    badge: '추천 3',
    title: 'Before & After',
    description:
      '변화는 눈으로 보여줘야죠! 시각적 임팩트가 강한 비포&애프터 스타일 템플릿',
    tags: ['변화', '임팩트', '시각적'],
    image:
      'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1400&q=80',
  },
];

export default function TemplatesClient() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [activeIndex, setActiveIndex] = useState(0);
  const [savedIds, setSavedIds] = useState<string[]>([]);

  const savedSet = useMemo(() => new Set(savedIds), [savedIds]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setSavedIds(parsed);
        }
      }
    } catch (error) {
      console.error('저장된 릴스 로드 실패:', error);
    }
  }, []);

  const handlePrev = () => {
    setActiveIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setActiveIndex((prev) => Math.min(trendCards.length - 1, prev + 1));
  };

  const handleStart = () => {
    if (!isAuthenticated) {
      router.push('/login?returnUrl=' + encodeURIComponent('/templates'));
      return;
    }
    router.push('/reels-maker');
  };

  const toggleSave = (id: string) => {
    if (!isAuthenticated) {
      router.push('/login?returnUrl=' + encodeURIComponent('/templates'));
      return;
    }

    setSavedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
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

  return (
    <div className="min-h-[calc(100vh-80px)] bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-8 pb-10 sm:pt-12 sm:pb-14">
        <div className="flex flex-col items-center text-center gap-2 mb-8 sm:mb-10">
          <p className="text-sm text-white/60 tracking-[0.3em] uppercase">맞춤형 릴스 추천</p>
          <h2 className="text-2xl sm:text-3xl font-bold">오늘의 트렌드 릴스 3가지</h2>
          <p className="text-sm sm:text-base text-white/70">
            당신의 비즈니스와 트렌드를 기반으로 바이럴 가능성이 높은 릴스를 추천합니다
          </p>
        </div>

        <div className="relative w-full flex items-center justify-center h-[520px] sm:h-[560px] md:h-[600px] pb-6 sm:pb-8">
          {trendCards.map((card, index) => {
            const isActive = index === activeIndex;
            const isSaved = savedSet.has(card.id);
            return (
              <div
                key={card.id}
                className="absolute left-1/2 top-1/2 w-[78vw] max-w-[360px] sm:w-[320px] lg:w-[360px] aspect-[3/4] rounded-[28px] overflow-hidden shadow-2xl transition-all duration-500 ease-out"
                style={getCardStyle(index)}
                aria-hidden={!isActive}
              >
                <div className="absolute inset-0 bg-center bg-cover" style={{ backgroundImage: `url(${card.image})` }} />
                <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/80" />

                <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-[#FF4D6D] text-xs font-semibold shadow-lg">
                  {card.badge}
                </div>

                <button
                  type="button"
                  onClick={() => toggleSave(card.id)}
                  aria-pressed={isSaved}
                  className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center hover:bg-white/30 transition-colors"
                >
                  <Bookmark
                    className={isSaved ? 'text-[#FF4D6D]' : 'text-white'}
                    fill={isSaved ? '#FF4D6D' : 'none'}
                  />
                </button>

                {isActive && (
                  <>
                    {activeIndex > 0 && (
                      <button
                        type="button"
                        onClick={handlePrev}
                        aria-label="이전 추천"
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-[#FF4D6D] shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
                      >
                        <ChevronLeft className="w-5 h-5 text-white" />
                      </button>
                    )}
                    {activeIndex < trendCards.length - 1 && (
                      <button
                        type="button"
                        onClick={handleNext}
                        aria-label="다음 추천"
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-[#FF4D6D] shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
                      >
                        <ChevronRight className="w-5 h-5 text-white" />
                      </button>
                    )}
                  </>
                )}

                <div className="absolute bottom-0 left-0 right-0 px-5 pb-6 pt-12">
                  <h3 className="text-xl sm:text-2xl font-bold mb-2 drop-shadow-lg">
                    {card.title}
                  </h3>
                  <p className="text-sm text-white/80 mb-4 leading-relaxed line-clamp-2">
                    {card.description}
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
        </div>

        <div className="mt-2 sm:mt-4 flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={handleStart}
            className="w-full max-w-md py-4 text-base sm:text-lg font-semibold rounded-full bg-[#FF4D6D] hover:bg-[#FF5F7A] transition-colors shadow-lg"
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
