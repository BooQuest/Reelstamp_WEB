'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: '릴스탬프는 어떤 서비스인가요?',
    answer:
      '릴스탬프는 마케팅 릴스를 쉽고 빠르게 제작할 수 있도록 도와주는 AI 기반 릴스 제작 플랫폼입니다. 비즈니스 정보를 입력하면 맞춤형 템플릿을 추천해드리고, 촬영 가이드와 함께 3분 안에 릴스를 완성할 수 있습니다.',
  },
  {
    question: '정말 3분 만에 릴스를 만들 수 있나요?',
    answer:
      '네! 릴스탬프는 AI가 자동으로 시나리오를 생성하고, 각 컷별로 촬영 가이드를 제공하며, 편집까지 자동으로 처리합니다. 사용자는 가이드에 따라 촬영만 하면 되기 때문에 평균 3분 이내에 완성도 높은 릴스를 제작할 수 있습니다.',
  },
  {
    question: '저장한 릴스는 어떻게 확인하나요?',
    answer:
      '메뉴에서 "저장된 릴스"를 선택하시면 북마크한 템플릿들을 확인할 수 있습니다. 또한 "제작 완료된 릴스"에서는 지금까지 만든 모든 릴스를 날짜별로 정리해서 볼 수 있으며, 다운로드나 공유도 가능합니다.',
  },
];

export default function FAQPage() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-gradient-to-b from-pink-50 to-white">
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <div
              key={faq.question}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
            >
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full px-6 py-4 flex items-center justify-between text-left"
              >
                <span className="font-semibold text-gray-900 pr-4">{faq.question}</span>
                {expandedIndex === index ? (
                  <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                )}
              </button>
              {expandedIndex === index && (
                <div className="px-6 pb-4">
                  <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
