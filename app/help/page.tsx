'use client';

import { useRouter } from 'next/navigation';
import { HelpCircle, MessageSquare } from 'lucide-react';

export default function HelpPage() {
  const router = useRouter();

  return (
    <div className="min-h-[calc(100vh-80px)] bg-gradient-to-b from-pink-50 to-white">
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="space-y-3">
          <button
            onClick={() => router.push('/faq')}
            className="w-full bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:bg-gray-50 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#FF496D]/10 rounded-full flex items-center justify-center flex-shrink-0">
                <HelpCircle className="w-6 h-6 text-[#FF496D]" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-semibold text-gray-900 mb-1">자주 묻는 질문</h3>
                <p className="text-sm text-gray-500">FAQ를 확인해보세요</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/contact')}
            className="w-full bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:bg-gray-50 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#FF496D]/10 rounded-full flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-6 h-6 text-[#FF496D]" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-semibold text-gray-900 mb-1">문의하기</h3>
                <p className="text-sm text-gray-500">질문이나 문제를 남겨주세요</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
