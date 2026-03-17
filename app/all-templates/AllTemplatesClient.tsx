'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/components/providers/AuthProvider';
import { LayoutTemplate } from 'lucide-react';

const templates = [
  {
    id: 'tpl-1',
    title: '고객 인터뷰 스타일',
    description: '실제 고객 후기로 신뢰도 UP! 감성 후기 스타일 템플릿',
    tags: ['고객후기', '신뢰감'],
  },
  {
    id: 'tpl-2',
    title: '비하인드 스토리',
    description: '제작 과정과 스토리를 보여주는 친근한 템플릿',
    tags: ['비하인드', '일상'],
  },
  {
    id: 'tpl-3',
    title: 'Before & After',
    description: '강한 대비로 임팩트를 주는 전환형 템플릿',
    tags: ['변화', '임팩트'],
  },
];

export default function AllTemplatesClient() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const handleCreate = () => {
    router.push(isAuthenticated ? '/contents/script-creation' : '/login');
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-gradient-to-b from-pink-50 to-white">
      <div className="max-w-5xl mx-auto px-4 py-10 sm:py-14">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-orange-100 text-[#FF496D] text-sm font-semibold">
            <LayoutTemplate className="w-4 h-4" />
            릴스 템플릿
          </div>
          <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold text-gray-900">릴스 템플릿 모아보기</h1>
          <p className="mt-3 text-base sm:text-lg text-gray-600">
            템플릿 탐색은 로그인 없이 가능합니다. 제작 시 로그인해주세요.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {templates.map((template) => (
            <div key={template.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{template.title}</h3>
              <p className="text-sm text-gray-600 mb-4">{template.description}</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {template.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 text-xs font-semibold text-[#FF496D] bg-[#FF496D]/10 rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
              <button
                onClick={handleCreate}
                className="w-full px-4 py-2 text-sm font-semibold text-white rounded-lg transition-all hover:shadow-md"
                style={{ backgroundColor: '#FF496D' }}
              >
                제작하기
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
