'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';

export default function ContactPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    subject: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      router.push('/help');
    }, 2000);
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-gradient-to-b from-pink-50 to-white">
      <div className="max-w-md mx-auto px-4 py-6">
        {submitted ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Send className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">문의가 접수되었습니다</h2>
            <p className="text-gray-600">빠른 시일 내에 답변 드리겠습니다.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">이메일 주소</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="답변을 받을 이메일을 입력해주세요"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF496D]/20 focus:border-[#FF496D]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">문의 제목</label>
              <input
                type="text"
                required
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="문의 제목을 입력해주세요"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF496D]/20 focus:border-[#FF496D]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">문의 내용</label>
              <textarea
                required
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="문의 내용을 자세히 작성해주세요"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF496D]/20 focus:border-[#FF496D] resize-none"
                rows={8}
              />
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-[#FF496D] text-white rounded-xl font-semibold hover:bg-[#FF496D]/90 transition-all flex items-center justify-center gap-2"
            >
              <Send className="w-5 h-5" />
              문의 보내기
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
