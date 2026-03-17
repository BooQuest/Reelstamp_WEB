'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Mail, Building, LogOut } from 'lucide-react';
import { useAuth } from '@/app/components/providers/AuthProvider';
import type { UserInfo } from '@/app/lib/api/auth';

interface AccountSettingsClientProps {
  initialUser: UserInfo;
}

export default function AccountSettingsClient({ initialUser }: AccountSettingsClientProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const displayUser = user ?? initialUser;
  const displayName = displayUser.nickname || displayUser.socialNickname || '릴스탬프 사용자';
  const displayEmail = displayUser.email || 'reelstamp@example.com';
  const displayBusiness = '릴스탬프 카페';

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.push('/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-gradient-to-b from-pink-50 to-white pb-24">
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Profile Info */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">내 정보</h2>
            <button
              onClick={() => router.push('/edit-profile')}
              className="text-sm text-[#FF496D] font-medium hover:text-[#FF496D]/80"
            >
              수정하기
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-500 mb-1 block">이름</label>
              <div className="flex items-center gap-3 text-gray-900">
                <User className="w-5 h-5 text-gray-400" />
                <span>{displayName}</span>
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-1 block">이메일</label>
              <div className="flex items-center gap-3 text-gray-900">
                <Mail className="w-5 h-5 text-gray-400" />
                <span>{displayEmail}</span>
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-1 block">비즈니스</label>
              <div className="flex items-center gap-3 text-gray-900">
                <Building className="w-5 h-5 text-gray-400" />
                <span>{displayBusiness}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3 mb-20">
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            <LogOut className="w-5 h-5 text-gray-700" />
            <span className="font-semibold text-gray-900">
              {isLoggingOut ? '로그아웃 중...' : '로그아웃'}
            </span>
          </button>

          <button className="w-full text-center py-2">
            <span className="text-xs text-gray-400 hover:text-gray-600 transition-all">회원 탈퇴</span>
          </button>
        </div>
      </div>
    </div>
  );
}
