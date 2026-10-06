'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Mail, LogOut } from 'lucide-react';
import { useAuth } from '@/app/components/providers/AuthProvider';
import CouponRegistration from './components/CouponRegistration';
import LoginSessions from './components/LoginSessions';
import AccountPeriod from './components/AccountPeriod';
import type { CouponAvailability, CouponResult, EntitlementSummary } from '@/app/lib/coupons/types';
import { buildLoginReturnHref } from '@/app/lib/auth/loginRedirect';
import type { UserInfo } from '@/app/lib/api/auth';

interface AccountSettingsClientProps {
  initialUser: UserInfo;
  initialEntitlements: EntitlementSummary | null;
  initialCouponAvailability: CouponAvailability | null;
}

export default function AccountSettingsClient({ initialUser, initialEntitlements, initialCouponAvailability }: AccountSettingsClientProps) {
  const router = useRouter();
  const { user, logout, refreshSubscription } = useAuth();
  const [registered, setRegistered] = useState<{ initial: EntitlementSummary | null; summary: EntitlementSummary } | null>(null);
  const entitlements = registered?.initial === initialEntitlements ? registered.summary : initialEntitlements;
  const handleRegistered = (result: CouponResult) => {
    setRegistered({ initial: initialEntitlements, summary: result.entitlements });
    void refreshSubscription();
    router.refresh();
  };
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const displayUser = user ?? initialUser;
  const isGuestUser = Boolean(displayUser.guest || displayUser.provider === 'GUEST');
  const displayName = displayUser.nickname || displayUser.socialNickname || '릴스탬프 사용자';
  const displayEmail = displayUser.email || (isGuestUser ? '가입 없이 이용 중' : '이메일 정보 없음');

  const handleLogout = async () => {
    if (!window.confirm('현재 브라우저에서 로그아웃할까요?')) return;
    setIsLoggingOut(true);
    try {
      await logout();
      router.push('/login');
    } catch {
      window.alert('로그아웃을 완료하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-gradient-to-b from-pink-50 to-white pb-24">
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Profile Info */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">내 정보</h2>

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
            <AccountPeriod summary={entitlements} onRetry={() => router.refresh()} />
          </div>
        </div>

        <LoginSessions />

        {/* Actions */}
        <div className="space-y-3 mb-20">
          <CouponRegistration initialAvailability={initialCouponAvailability} isGuest={isGuestUser}
            onLogin={() => router.push(buildLoginReturnHref('/account-settings'))} onRegistered={handleRegistered} />
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
