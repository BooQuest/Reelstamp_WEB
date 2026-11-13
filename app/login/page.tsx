// 로그인 페이지: 네이버/카카오 소셜 로그인 제공
import { redirect } from 'next/navigation';
import LoginClient from './LoginClient';
import { getCurrentUser } from '@/app/lib/api/auth';
import { getSafeLoginReturnUrl, LOGIN_HOME_PATH } from '@/app/lib/auth/loginRedirect';
import { isDeletionCallback } from '@/app/lib/account-deletion/server';

// 캐시 방지 및 실시간 인증 상태 확인을 위해 강제 동적 렌더링 설정
export const dynamic = 'force-dynamic';
export const metadata = { referrer: 'no-referrer' as const };

interface LoginPageProps {
  searchParams?: Promise<{
    returnUrl?: string;
    code?: string;
    state?: string;
    error?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  // Deletion reauthentication retains the existing session. Handle its purpose
  // before the usual redirect of an already authenticated social account.
  if (await isDeletionCallback(resolvedSearchParams ?? {})) {
    return <LoginClient accountDeletionCallback />;
  }
  // 서버 사이드에서 로그인 여부 확인
  const user = await getCurrentUser();
  
  // 소셜 로그인 사용자는 로그인 페이지 접근을 차단하고, 게스트는 계정 전환을 위해 허용합니다.
  if (user && !user.guest && user.provider !== 'GUEST') {
    const returnUrl = getSafeLoginReturnUrl(resolvedSearchParams?.returnUrl);
    redirect(returnUrl ?? LOGIN_HOME_PATH);
  }

  return <LoginClient />;
}
