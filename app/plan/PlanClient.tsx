'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Crown, Sparkles } from 'lucide-react';
import { useAuth } from '@/app/components/providers/AuthProvider';

export default function PlanClient() {
  const router = useRouter();
  const { subscription, isLoadingSubscription } = useAuth();

  const subInfo = subscription?.subscription;
  const planInfo = subscription?.subscriptionPlan;

  const planCode = planInfo?.plan || (subInfo?.active ? 'plus' : 'free');
  const planName = `${planCode.toUpperCase()} Plan`;
  const isFreePlan = !subInfo?.active;
  const isCanceled = subInfo?.status === 'CANCELED' || subInfo?.status === 'CANCELLED';

  const statusText = useMemo(() => {
    if (isLoadingSubscription) return '구독 정보를 불러오는 중...';
    if (isFreePlan) return '현재 무료 플랜을 사용 중입니다.';
    if (!subInfo) return `${planName}을(를) 사용 중입니다.`;
    if (isCanceled) {
      return `${formatDate(subInfo.validUntil)}까지 서비스를 이용하실 수 있습니다.`;
    }
    return `다음 결제일은 ${formatDate(subInfo.nextBillingDate)}입니다.`;
  }, [isLoadingSubscription, isFreePlan, subInfo, isCanceled, planName]);

  const planBenefits = [
    { icon: Sparkles, text: 'AI 대본 생성 무제한' },
  ];

  return (
    <div className="min-h-[calc(100vh-80px)] bg-gradient-to-b from-pink-50 to-white pb-24">
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FF496D] to-[#FF8A5B] flex items-center justify-center">
                <Crown className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-500">현재 플랜</p>
                <h2 className="text-xl font-bold text-gray-900">{planName}</h2>
              </div>
            </div>
            <button
              onClick={() => router.push('/pricing')}
              className="px-3 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              관리
            </button>
          </div>

          {planInfo?.description && (
            <p className="text-sm text-gray-600 mt-3">{planInfo.description}</p>
          )}

          <p className="text-sm text-gray-600 mt-4">{statusText}</p>

          {isCanceled && (
            <span className="inline-flex mt-3 items-center rounded-full bg-[#FFE8EC] px-3 py-1 text-xs font-semibold text-[#B42318]">
              구독 해지 예약됨
            </span>
          )}
        </div>

        {isFreePlan && (
          <div className="bg-gradient-to-r from-[#EB48B1]/10 to-[#F59A39]/10 rounded-2xl p-5 border border-[#F4D6E5] mb-6">
            <h3 className="text-base font-semibold text-gray-900 mb-3">
              Reelstamp Plus로 업그레이드하세요!
            </h3>
            <ul className="space-y-2">
              {planBenefits.map((benefit, index) => (
                <li key={index} className="flex items-start gap-3">
                  <benefit.icon className="w-5 h-5 text-[#EB48B1] flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">{benefit.text}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => router.push('/pricing')}
              className="mt-4 w-full px-4 py-3 text-sm font-semibold text-white rounded-xl transition-all hover:opacity-90"
              style={{ backgroundColor: '#FF496D' }}
            >
              요금제 보러가기
            </button>
          </div>
        )}

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-base font-semibold text-gray-900 mb-3">플랜 혜택</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF496D]" />
              AI 대본 생성
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF496D]" />
              템플릿 추천 및 제작 가이드
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF496D]" />
              저장/완료 릴스 관리
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

const formatDate = (dateString?: string): string => {
  if (!dateString) return '날짜 정보 없음';
  try {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}년 ${month}월 ${day}일`;
  } catch {
    return dateString;
  }
};
