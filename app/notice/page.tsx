import type { Metadata } from 'next';
import { Bell, CheckCircle2, Clock, MessageCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: '공지사항 - 릴스탬프',
  description: '릴스탬프 서비스 이용과 템플릿 요청, 개발 대응 안내',
};

const notices = [
  {
    icon: CheckCircle2,
    title: '트렌드 템플릿에 대한 안내',
    description:
      '릴스탬프의 트렌드 템플릿은 실제로 반응이 좋았던 릴스 흐름을 분석해, 촬영과 제작을 더 쉽게 따라갈 수 있도록 정리한 템플릿입니다. 업종과 상황에 맞게 참고하며 활용해주세요.',
  },
  {
    icon: Clock,
    title: '템플릿 요청에 대한 안내',
    description:
      '템플릿 요청하기로 의견을 보내주셔도 기술적인 구현 난이도나 서비스 성격상 바로 개발하기 어려운 템플릿이 있을 수 있습니다. 남겨주신 요청은 검토 후 추후 개발에 최대한 반영하겠습니다.',
  },
  {
    icon: MessageCircle,
    title: '개발 이슈 대응에 대한 안내',
    description:
      '현재 릴스탬프는 2인 팀으로 운영되고 있어 개발 이슈가 발생했을 때 실시간 대응이 어려울 수 있습니다. 최대한 빠르게 확인하고 답변드리며, 서비스 안정화와 개선을 통해 더 빠른 대응과 좋은 경험을 제공하겠습니다.',
  },
];

export default function NoticePage() {
  return (
    <div className="min-h-[calc(100vh-80px)] bg-white">
      <section className="border-b border-gray-100 bg-gradient-to-b from-[#FFF5F8] to-white">
        <div className="mx-auto max-w-3xl px-5 py-12 sm:px-6 sm:py-16">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-[#FF496D]/10 text-[#FF496D]">
            <Bell className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="mb-3 text-sm font-semibold text-[#FF496D]">릴스탬프 공지</p>
          <h1 className="text-3xl font-bold leading-tight text-gray-950 sm:text-4xl">
            공지사항
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-gray-600 sm:text-lg">
            릴스탬프를 더 편안하게 이용하실 수 있도록 템플릿과 개발 대응에 대한 안내를 전해드립니다.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-8 sm:px-6 sm:py-10">
        <div className="space-y-4">
          {notices.map((notice, index) => {
            const Icon = notice.icon;

            return (
              <article
                key={notice.title}
                className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm sm:p-6"
              >
                <div className="flex gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#FF496D]/10 text-[#FF496D]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold text-gray-400">
                      공지 {String(index + 1).padStart(2, '0')}
                    </p>
                    <h2 className="text-lg font-bold text-gray-950 sm:text-xl">
                      {notice.title}
                    </h2>
                    <p className="mt-3 text-[15px] leading-7 text-gray-600 sm:text-base">
                      {notice.description}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
