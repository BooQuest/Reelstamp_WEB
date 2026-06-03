// 로그인 페이지: 네이버/카카오 소셜 로그인 제공
import { redirect } from 'next/navigation';
import LoginClient from './LoginClient';
import { getCurrentUser } from '@/app/lib/api/auth';

// 캐시 방지 및 실시간 인증 상태 확인을 위해 강제 동적 렌더링 설정
export const dynamic = 'force-dynamic';

interface LoginPageProps {
  searchParams?: Promise<{
    returnUrl?: string;
  }>;
}

const getSafeReturnUrl = (value?: string) => {
  if (!value) return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  return value;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  // 서버 사이드에서 로그인 여부 확인
  const user = await getCurrentUser();
  
  // 소셜 로그인 사용자는 로그인 페이지 접근을 차단하고, 게스트는 계정 전환을 위해 허용합니다.
  if (user && !user.guest && user.provider !== 'GUEST') {
    console.log(`[LoginPage SSR] 이미 로그인된 사용자(${user.nickname}), 리다이렉트 수행`);
    const resolvedSearchParams = searchParams ? await searchParams : undefined;
    const returnUrl = getSafeReturnUrl(resolvedSearchParams?.returnUrl);
    redirect(returnUrl ?? '/templates');
  }

  return <LoginClient />;
}
