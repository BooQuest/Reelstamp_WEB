import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Bell } from 'lucide-react';

export const metadata: Metadata = {
  title: '공지사항 - 릴스탬프',
  description: '릴스탬프 서비스 이용과 템플릿 요청, 개발 대응 안내',
};

const notices = [
  {
    title: '베타 서비스 운영 안내',
    description:
      '릴스탬프는 현재 베타 기간으로, 9월 9일 정식 출시 예정입니다. 베타 기간에는 일부 기능이 불안정할 수 있습니다. 더 완성도 높은 서비스로 찾아뵙기 위해 최선을 다하겠습니다.',
  },
  {
    title: '릴스 템플릿이란?',
    description:
      '반응이 좋았던 릴스를 쉽게 따라 만들 수 있도록 정리한 템플릿입니다. 후킹·트렌드·스테디 템플릿을 마케팅 목적에 맞게 활용해보세요.',
  },
  {
    title: '오늘의 릴스 트렌드란?',
    description:
      '현재 유행 중인 마케팅 릴스를 자체 알고리즘으로 순위화해, 지금 뜨고 있는 포맷을 한눈에 확인할 수 있는 기능입니다.',
  },
  {
    title: '문의 및 개발 이슈 안내',
    description: (
      <>
        오류 제보와 기능 문의는{' '}
        <strong className="font-bold text-gray-950">마이페이지 &gt; 고객센터</strong>를
        이용해주세요. 최대한 빠르게 확인하겠습니다.
      </>
    ),
  },
] satisfies Array<{ title: string; description: ReactNode }>;

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
            릴스탬프를 더 편안하게 이용하실 수 있도록 서비스 운영과 이용 안내를 전해드립니다.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-8 sm:px-6 sm:py-10">
        <div className="space-y-4">
          {notices.map((notice, index) => (
            <article
              key={notice.title}
              className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm sm:p-6"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#FF496D]/10 text-base font-extrabold text-[#FF496D]">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="pt-1.5 text-lg font-bold leading-7 text-gray-950 [word-break:keep-all] sm:text-xl">
                    {notice.title}
                  </h2>
                  <p className="mt-3 text-[15px] leading-7 text-gray-600 [word-break:keep-all] sm:text-base">
                    {notice.description}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
