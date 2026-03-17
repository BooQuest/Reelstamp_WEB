'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sparkles, PlayCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '@/app/components/providers/AuthProvider';

export default function TemplatesClient() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const handleStart = () => {
    router.push(isAuthenticated ? '/contents/script-creation' : '/login');
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-gradient-to-b from-pink-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-10 sm:py-14">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-pink-100 text-[#FF496D] text-sm font-semibold">
            <Sparkles className="w-4 h-4" />
            맞춤형 릴스 추천
          </div>
          <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold text-gray-900">
            오늘 바로 반응 오는 릴스를 추천받아보세요
          </h1>
          <p className="mt-3 text-base sm:text-lg text-gray-600">
            비로그인 상태에서도 추천 콘텐츠는 열람 가능합니다.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={handleStart}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 text-base font-semibold text-white rounded-xl shadow-sm transition-all hover:shadow-md"
            style={{ backgroundColor: '#FF496D' }}
          >
            <PlayCircle className="w-5 h-5" />
            3분 만에 만들기
          </button>
          <Link
            href="/all-templates"
            className="w-full flex items-center justify-center gap-2 px-5 py-3 text-base font-semibold text-[#2B2D37] bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
          >
            다른 템플릿 보러가기
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="mt-10 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <p className="text-sm text-gray-500">추천 콘텐츠 영역 (준비중)</p>
        </div>
      </div>
    </div>
  );
}
