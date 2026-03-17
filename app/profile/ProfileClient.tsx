'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { User, Mail, Building, HelpCircle, LogOut, Settings, Crown, CreditCard, MessageCircle } from 'lucide-react';
import { useAuth } from '@/app/components/providers/AuthProvider';
import type { UserInfo } from '@/app/lib/api/auth';

interface ProfileClientProps {
  initialUser: UserInfo;
}

export default function ProfileClient({ initialUser }: ProfileClientProps) {
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
    <div className="min-h-[calc(100vh-80px)] bg-gradient-to-b from-pink-50 to-white">
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-[#FF496D] to-[#FF8A5B] rounded-full flex items-center justify-center overflow-hidden">
              {displayUser.profileImageUrl ? (
                <Image
                  src={displayUser.profileImageUrl}
                  alt="프로필"
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              ) : (
                <User className="w-10 h-10 text-white" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{displayName}</h2>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 text-gray-600">
              <Mail className="w-5 h-5" />
              <span className="text-sm">{displayEmail}</span>
            </div>
            <div className="flex items-center gap-3 text-gray-600">
              <Building className="w-5 h-5" />
              <span className="text-sm">{displayBusiness}</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => router.push('/completed-reels')}
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center hover:bg-gray-50 transition-all"
          >
            <p className="text-3xl font-bold text-[#FF496D] mb-1">12</p>
            <p className="text-sm text-gray-600">제작한 릴스</p>
          </button>
          <button
            onClick={() => router.push('/saved-reels')}
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center hover:bg-gray-50 transition-all"
          >
            <p className="text-3xl font-bold text-[#FF496D] mb-1">5</p>
            <p className="text-sm text-gray-600">저장한 템플릿</p>
          </button>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={() => router.push('/account-settings')}
            className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-left hover:bg-gray-50 transition-all flex items-center gap-3"
          >
            <Settings className="w-5 h-5 text-gray-500" />
            <span className="font-semibold text-gray-900">계정 설정</span>
          </button>

          <button
            onClick={() => router.push('/plan')}
            className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-left hover:bg-gray-50 transition-all flex items-center gap-3"
          >
            <Crown className="w-5 h-5 text-gray-500" />
            <span className="font-semibold text-gray-900">이용 중인 플랜</span>
          </button>

          <button
            onClick={() => router.push('/pricing')}
            className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-left hover:bg-gray-50 transition-all flex items-center gap-3"
          >
            <CreditCard className="w-5 h-5 text-gray-500" />
            <span className="font-semibold text-gray-900">요금제</span>
          </button>

          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.open('https://pf.kakao.com/_Bbyxon', '_blank', 'noopener,noreferrer');
              }
            }}
            className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-left hover:bg-gray-50 transition-all flex items-center gap-3"
          >
            <MessageCircle className="w-5 h-5 text-gray-500" />
            <span className="font-semibold text-gray-900">고객센터</span>
          </button>

          <button
            onClick={() => router.push('/help')}
            className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-left hover:bg-gray-50 transition-all flex items-center gap-3"
          >
            <HelpCircle className="w-5 h-5 text-gray-500" />
            <span className="font-semibold text-gray-900">도움말</span>
          </button>

          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-left hover:bg-gray-50 transition-all flex items-center gap-3 disabled:opacity-50"
          >
            <LogOut className="w-5 h-5 text-red-500" />
            <span className="font-semibold text-red-500">
              {isLoggingOut ? '로그아웃 중...' : '로그아웃'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
