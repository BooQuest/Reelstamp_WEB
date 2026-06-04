'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { loginAsGuestAction, loginWithSocialAction } from '@/app/actions/auth';
import { useAuth } from '@/app/components/providers/AuthProvider';
import LoadingOverlay from '@/app/components/ui/LoadingOverlay';
import type { SocialAuthProvider } from '@/app/lib/api/auth';

// 카카오 SDK 타입 정의
interface KakaoSdk {
  isInitialized: () => boolean;
  init: (key: string) => void;
  Auth: {
    authorize: (options: { redirectUri: string }) => void;
  };
}

declare global {
  interface Window {
    Kakao?: KakaoSdk;
  }
}

type OAuthTokenResponse = {
  access_token?: string;
  error_description?: string;
  message?: string;
};

const getSafeReturnUrl = (value: string | null | undefined) => {
  if (!value) return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  return value;
};

const TECHNICAL_ERROR_MESSAGES = new Set(['unknown error', 'unknown_error']);
const GUEST_LOGIN_ERROR_MESSAGE =
  '게스트 로그인을 처리하는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';

const isTechnicalErrorMessage = (message?: string) => {
  const normalizedMessage = message?.trim().toLowerCase();

  return Boolean(
    normalizedMessage &&
      (TECHNICAL_ERROR_MESSAGES.has(normalizedMessage) ||
        normalizedMessage.startsWith('request failed with status code 5') ||
        normalizedMessage === 'internal server error')
  );
};

const getDisplayErrorMessage = (message: string | undefined, fallbackMessage: string) => {
  return isTechnicalErrorMessage(message) ? fallbackMessage : message || fallbackMessage;
};

const getErrorMessage = (error: unknown, fallbackMessage: string) => {
  return error instanceof Error
    ? getDisplayErrorMessage(error.message, fallbackMessage)
    : fallbackMessage;
};

export default function LoginClient() {
  const router = useRouter();
  const { user, setUser, isAuthenticated } = useAuth();
  const [isLoadingKakao, setIsLoadingKakao] = useState(false);
  const [isLoadingNaver, setIsLoadingNaver] = useState(false);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isLoadingGuest, setIsLoadingGuest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState('로그인 중...');
  const [isProcessing, setIsProcessing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [allAgreed, setAllAgreed] = useState(false);
  const [guestNickname, setGuestNickname] = useState('');
  const isGuestUser = Boolean(user?.guest || user?.provider === 'GUEST');
  const isSocialAuthenticated = isAuthenticated && !isGuestUser;

  // 초기 마운트 시 mounted 상태 설정
  useEffect(() => {
    setMounted(true);
  }, []);

  // 카카오 SDK 초기화
  const initKakao = () => {
    if (typeof window !== 'undefined' && window.Kakao && !window.Kakao.isInitialized()) {
      const kakaoKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
      if (!kakaoKey) {
        console.warn('NEXT_PUBLIC_KAKAO_JS_KEY 환경 변수가 설정되지 않았습니다.');
        return;
      }
      window.Kakao.init(kakaoKey);
    }
  };

  const buildOauthState = (prefix: 'naver' | 'google') => {
    const randomPart =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2, 12);
    return `${prefix}_${randomPart}`;
  };

  useEffect(() => {
    const timer = setInterval(() => {
      if (window.Kakao) {
        initKakao();
        clearInterval(timer);
      }
    }, 1000);

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const returnUrlParam = getSafeReturnUrl(urlParams.get('returnUrl'));

    if (returnUrlParam) {
      sessionStorage.setItem('previousPath', returnUrlParam);
    } else if (!returnUrlParam && !code) {
      sessionStorage.removeItem('previousPath');
    }

    if (code && !isProcessing && !isSocialAuthenticated) {
      setIsProcessing(true);
      
      const cleanUrl = window.location.pathname + (returnUrlParam ? `?returnUrl=${encodeURIComponent(returnUrlParam)}` : '');
      window.history.replaceState({}, '', cleanUrl);

      const storedProvider = sessionStorage.getItem('oauth_provider') as
        | 'KAKAO'
        | 'NAVER'
        | 'GOOGLE'
        | null;
      const storedState = sessionStorage.getItem('oauth_state');

      const inferredProvider =
        storedProvider ||
        (state?.startsWith('naver_')
          ? 'NAVER'
          : state?.startsWith('google_')
            ? 'GOOGLE'
            : 'KAKAO');

      const requiresState = inferredProvider === 'NAVER' || inferredProvider === 'GOOGLE';
      if (requiresState) {
        if (!state) {
          setError('로그인 state 정보가 누락되었습니다. 다시 시도해주세요.');
          setIsProcessing(false);
          return;
        }
        if (storedState && state !== storedState) {
          setError('로그인 state 검증에 실패했습니다. 다시 시도해주세요.');
          setIsProcessing(false);
          return;
        }
      }

      sessionStorage.removeItem('oauth_provider');
      sessionStorage.removeItem('oauth_state');

      if (inferredProvider === 'NAVER') {
        handleNaverCode(code, state as string);
      } else if (inferredProvider === 'GOOGLE') {
        handleGoogleCode(code, state as string);
      } else {
        handleKakaoCode(code);
      }
    }

    return () => clearInterval(timer);
  }, [isProcessing, isSocialAuthenticated]);

  // [카카오] 인가 코드를 액세스 토큰으로 교환
  const handleKakaoCode = async (code: string) => {
    setIsLoadingKakao(true);
    setLoadingText('카카오 로그인 처리 중...');
    setError(null);
    try {
      const kakaoKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
      if (!kakaoKey) throw new Error('카카오 API 키가 설정되지 않았습니다.');

      const redirectUri = `${window.location.origin}/login`;
      const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: kakaoKey,
          redirect_uri: redirectUri,
          code: code,
        }),
      });

      const tokenData = (await tokenResponse.json()) as OAuthTokenResponse;
      if (!tokenResponse.ok || !tokenData.access_token) {
        throw new Error(tokenData.error_description || '카카오 토큰 교환 실패');
      }

      await processLogin(tokenData.access_token, 'KAKAO', setIsLoadingKakao);
    } catch (err: unknown) {
      setError(getErrorMessage(err, '카카오 토큰 교환 실패'));
      setIsLoadingKakao(false);
    } finally {
      setIsProcessing(false);
    }
  };

  // [네이버] 인가 코드를 액세스 토큰으로 교환
  const handleNaverCode = async (code: string, state: string) => {
    setIsLoadingNaver(true);
    setLoadingText('네이버 로그인 처리 중...');
    setError(null);
    try {
      const response = await fetch('/api/auth/naver-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, state }),
      });

      const data = (await response.json()) as OAuthTokenResponse;
      if (!response.ok || !data.access_token) {
        throw new Error(data.message || '네이버 토큰 교환 실패');
      }

      await processLogin(data.access_token, 'NAVER', setIsLoadingNaver);
    } catch (err: unknown) {
      setError(getErrorMessage(err, '네이버 토큰 교환 실패'));
      setIsLoadingNaver(false);
    } finally {
      setIsProcessing(false);
    }
  };

  // [구글] 인가 코드를 액세스 토큰으로 교환
  const handleGoogleCode = async (code: string, state: string) => {
    setIsLoadingGoogle(true);
    setLoadingText('구글 로그인 처리 중...');
    setError(null);
    try {
      const redirectUri = `${window.location.origin}/login`;
      const response = await fetch('/api/auth/google-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, state, redirectUri }),
      });

      const data = (await response.json()) as OAuthTokenResponse;
      if (!response.ok || !data.access_token) {
        throw new Error(data.message || '구글 토큰 교환 실패');
      }

      await processLogin(data.access_token, 'GOOGLE', setIsLoadingGoogle);
    } catch (err: unknown) {
      setError(getErrorMessage(err, '구글 토큰 교환 실패'));
      setIsLoadingGoogle(false);
    } finally {
      setIsProcessing(false);
    }
  };

  // 공통 로그인 처리 로직: Server Action 사용 (httpOnly 쿠키에 토큰 저장)
  const processLogin = async (
    accessToken: string,
    provider: SocialAuthProvider,
    setLoading: (loading: boolean) => void
  ) => {
    try {
      setLoadingText('로그인 완료 중...');
      const result = await loginWithSocialAction(accessToken, provider);
      
      if (!result.success) {
        setError(getDisplayErrorMessage(result.message, '로그인 처리 중 오류가 발생했습니다.'));
        setLoading(false);
        return;
      }

      if (result.userInfo) {
        setUser(result.userInfo);
      }
      
      sessionStorage.removeItem('oauth_provider');
      sessionStorage.removeItem('oauth_state');
      
      // 리다이렉트 전에 로딩을 명시적으로 해제 (UX 개선)
      setLoading(false);
      
      try {
        const storedPath = getSafeReturnUrl(sessionStorage.getItem('previousPath'));
        if (storedPath) {
          sessionStorage.removeItem('previousPath');
          router.replace(storedPath);
        } else {
          router.replace('/templates');
        }
      } catch (pushError) {
        console.error('[processLogin] 리다이렉트 실패:', pushError);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, '로그인 처리 중 오류가 발생했습니다.'));
      setLoading(false);
    }
  };

  // 전체 동의 체크박스 핸들러
  const handleAllAgreed = (checked: boolean) => {
    setAllAgreed(checked);
    setTermsAgreed(checked);
    setPrivacyAgreed(checked);
  };

  // 개별 약관 체크 시 전체 동의 상태 업데이트
  useEffect(() => {
    setAllAgreed(termsAgreed && privacyAgreed);
  }, [termsAgreed, privacyAgreed]);

  // 약관 동의 여부 확인
  const isAllAgreed = termsAgreed && privacyAgreed;
  const hasGuestNickname = Boolean(guestNickname.trim());
  const canSubmitGuest = isAllAgreed && hasGuestNickname && !isLoadingGuest;

  const handleGuestLogin = async () => {
    if (isGuestUser) return;
    if (!isAllAgreed) {
      setError('약관에 동의해주세요.');
      return;
    }

    const normalizedNickname = guestNickname.trim();
    if (!normalizedNickname) {
      setError('닉네임을 입력해주세요.');
      return;
    }

    setIsLoadingGuest(true);
    setLoadingText('가입 없이 이용 준비 중...');
    setError(null);

    try {
      const result = await loginAsGuestAction(normalizedNickname);
      if (!result.success) {
        setError(getDisplayErrorMessage(result.message, GUEST_LOGIN_ERROR_MESSAGE));
        return;
      }

      if (result.userInfo) {
        setUser(result.userInfo);
      }

      sessionStorage.removeItem('previousPath');
      router.replace('/templates');
    } catch (err: unknown) {
      setError(getErrorMessage(err, '가입 없이 이용하기 처리 중 오류가 발생했습니다.'));
    } finally {
      setIsLoadingGuest(false);
    }
  };

  // 카카오 로그인 핸들러
  const handleKakaoLogin = () => {
    if (!isAllAgreed) {
      setError('약관에 동의해주세요.');
      return;
    }
    if (!window.Kakao) {
      setError('카카오 SDK가 로드되지 않았습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    if (!window.Kakao.isInitialized()) {
      initKakao();
    }

    setIsLoadingKakao(true);
    setLoadingText('카카오 로그인 중...');
    setError(null);
    sessionStorage.setItem('oauth_provider', 'KAKAO');
    sessionStorage.removeItem('oauth_state');

    window.Kakao.Auth.authorize({
      redirectUri: `${window.location.origin}/login`,
    });
  };

  // 네이버 로그인 핸들러
  const handleNaverLogin = () => {
    if (!isAllAgreed) {
      setError('약관에 동의해주세요.');
      return;
    }
    const clientId = process.env.NEXT_PUBLIC_NAVER_CLIENT_ID;
    if (!clientId) {
      setError('네이버 API 키가 설정되지 않았습니다.');
      return;
    }

    const redirectUri = encodeURIComponent(`${window.location.origin}/login`);
    const state = buildOauthState('naver');
    
    setIsLoadingNaver(true);
    setLoadingText('네이버 로그인 중...');
    setError(null);
    sessionStorage.setItem('oauth_provider', 'NAVER');
    sessionStorage.setItem('oauth_state', state);

    const naverAuthUrl = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}`;
    window.location.href = naverAuthUrl;
  };

  // 구글 로그인 핸들러
  const handleGoogleLogin = () => {
    if (!isAllAgreed) {
      setError('약관에 동의해주세요.');
      return;
    }
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setError('구글 클라이언트 ID가 설정되지 않았습니다.');
      return;
    }

    const redirectUri = `${window.location.origin}/login`;
    const state = buildOauthState('google');
    const scope = encodeURIComponent('openid email profile');

    setIsLoadingGoogle(true);
    setLoadingText('구글 로그인 중...');
    setError(null);
    sessionStorage.setItem('oauth_provider', 'GOOGLE');
    sessionStorage.setItem('oauth_state', state);

    const googleAuthUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?response_type=code` +
      `&client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${scope}` +
      `&state=${encodeURIComponent(state)}`;

    window.location.href = googleAuthUrl;
  };

  // 아직 마운트 전이면 아무것도 렌더링하지 않음
  if (!mounted) {
    return null;
  }

  // 로딩 오버레이 표시 여부 결정
  const showOverlay = isLoadingKakao || isLoadingNaver || isLoadingGoogle || isLoadingGuest || isProcessing;

  return (
    <div className="bg-white flex flex-col items-center justify-start px-4 py-20 sm:py-20 md:py-28 lg:py-40 xl:py-48 min-h-[calc(100vh-80px)] relative overflow-x-hidden">
      <Script
        src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.0/kakao.min.js"
        strategy="afterInteractive"
        onLoad={initKakao}
        onError={() => {
          setError('카카오 SDK를 불러오는 데 실패했습니다.');
        }}
      />

      {/* 배경 디자인 - 모바일 */}
      <div 
        className="absolute inset-0 flex items-center justify-center pointer-events-none sm:hidden overflow-hidden"
        style={{ top: '60%', opacity: 0.25, left: 0, right: 0 }}
      >
        <span 
          className="text-[150px] font-bold whitespace-nowrap"
          style={{ 
            fontFamily: 'Helvetica, Arial, sans-serif',
            fontWeight: 700,
            lineHeight: '150%',
            letterSpacing: '-0.05em',
            background: 'linear-gradient(to bottom, #FFFFFF, #FFB4C7)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Reelstamp
        </span>
      </div>

      {/* 배경 디자인 - 데스크톱 */}
      <div 
        className="hidden sm:flex absolute inset-0 items-center justify-center pointer-events-none overflow-hidden"
        style={{ top: '30%', opacity: 0.25, left: 0, right: 0 }}
      >
        <span 
          className="text-[250px] md:text-[350px] lg:text-[450px] font-bold whitespace-nowrap"
          style={{ 
            fontFamily: 'Helvetica, Arial, sans-serif',
            fontWeight: 700,
            lineHeight: '150%',
            letterSpacing: '-0.05em',
            background: 'linear-gradient(to bottom, #FFFFFF, #FFB4C7)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Reelstamp
        </span>
      </div>

      <div className="w-full max-w-md space-y-8 relative z-10">
        {/* 로그인 처리 중이 아닐 때만 실제 콘텐츠 노출 (깜빡임 방지) */}
        {!showOverlay ? (
          <>
            <div className="text-center">
              <p className="text-gray-700 text-lg mb-1 md:mb-1">
                100만뷰 릴스 제작 파트너
              </p>
              
              <div className="mb-12 md:mb-12">
                <span 
                  className="text-5xl md:text-6xl font-bold leading-[150%] tracking-[-0.05em] block"
                  style={{ 
                    fontFamily: 'Helvetica, Arial, sans-serif',
                    color: '#FF496D',
                  }}
                >
                  Reelstamp
                </span>
              </div>
            </div>

            {/* 약관 동의 체크박스 */}
            <div className="space-y-3 mb-4 w-full">
              <div className="w-full">
                <div className="flex items-center pb-3 border-b border-gray-200 px-4 sm:px-6 md:px-16">
                  <input
                    type="checkbox"
                    id="all-agreement"
                    checked={allAgreed}
                    onChange={(e) => handleAllAgreed(e.target.checked)}
                    className="w-4 h-4 text-[#FF496D] border-gray-300 rounded focus:ring-[#FF496D] cursor-pointer"
                  />
                  <label htmlFor="all-agreement" className="ml-2 text-sm font-semibold text-gray-900 cursor-pointer">
                    전체 동의
                  </label>
                </div>
              </div>
              <div className="w-full space-y-2 px-4 sm:px-6 md:px-16">
                <div className="flex items-start">
                  <input
                    type="checkbox"
                    id="terms-agreement"
                    checked={termsAgreed}
                    onChange={(e) => setTermsAgreed(e.target.checked)}
                    className="mt-1 w-4 h-4 text-[#FF496D] border-gray-300 rounded focus:ring-[#FF496D] cursor-pointer"
                  />
                  <label htmlFor="terms-agreement" className="ml-2 text-sm text-gray-700 cursor-pointer">
                    <a
                      href="/terms-of-service"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#FF496D] hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      서비스 이용약관
                    </a>
                    에 동의합니다 (필수)
                  </label>
                </div>
                <div className="flex items-start">
                  <input
                    type="checkbox"
                    id="privacy-agreement"
                    checked={privacyAgreed}
                    onChange={(e) => setPrivacyAgreed(e.target.checked)}
                    className="mt-1 w-4 h-4 text-[#FF496D] border-gray-300 rounded focus:ring-[#FF496D] cursor-pointer"
                  />
                  <label htmlFor="privacy-agreement" className="ml-2 text-sm text-gray-700 cursor-pointer">
                    <a
                      href="/privacy-policy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#FF496D] hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      개인정보 처리방침
                    </a>
                    에 동의합니다 (필수)
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-2 md:space-y-3">
              <button
                type="button"
                className={`w-full h-14 transition-all active:scale-[0.98] ${
                  isAllAgreed
                    ? 'cursor-pointer hover:opacity-90'
                    : 'cursor-not-allowed opacity-50'
                }`}
                aria-label="구글로 로그인"
                onClick={handleGoogleLogin}
                disabled={!isAllAgreed}
              >
                <span className="w-full max-w-[330px] h-full mx-auto rounded-xl border-2 border-gray-300 bg-white flex items-center justify-center gap-3">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span className="text-gray-700 font-semibold">구글로 로그인</span>
                </span>
              </button>

              <button
                type="button"
                className={`w-full h-14 rounded-xl transition-all active:scale-[0.98] ${
                  isAllAgreed
                    ? 'cursor-pointer hover:opacity-90'
                    : 'cursor-not-allowed opacity-50'
                }`}
                aria-label="네이버로 로그인"
                onClick={handleNaverLogin}
                disabled={!isAllAgreed}
              >
                <Image
                  src="/images/login_naver.png"
                  alt="네이버로 로그인"
                  width={400}
                  height={56}
                  className="w-full h-full object-contain rounded-xl"
                  priority
                />
              </button>

              <button
                type="button"
                className={`w-full h-14 rounded-xl transition-all active:scale-[0.98] ${
                  isAllAgreed
                    ? 'cursor-pointer hover:opacity-90'
                    : 'cursor-not-allowed opacity-50'
                }`}
                aria-label="카카오톡으로 로그인"
                onClick={handleKakaoLogin}
                disabled={!isAllAgreed}
              >
                <Image
                  src="/images/login_kakao.png"
                  alt="카카오톡으로 로그인"
                  width={400}
                  height={56}
                  className="w-full h-full object-contain rounded-xl"
                  priority
                />
              </button>
            </div>

            {isGuestUser ? (
              <div className="mt-6 rounded-xl border border-[#FF496D]/20 bg-[#FFF5F7] px-4 py-4">
                <p className="text-sm font-semibold text-gray-900">
                  {user?.nickname || '게스트'}님은 가입 없이 이용 중입니다.
                </p>
                <p className="mt-2 text-xs leading-5 text-gray-600">
                  작업 내용을 안전하게 보관하려면 회원가입 후 이용하는 것을 권장합니다.
                  같은 브라우저에서 위 소셜 로그인을 진행하면 현재 작업을 계정에 연결합니다.
                </p>
              </div>
            ) : (
              <div className="mt-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-xs font-medium text-gray-400">또는</span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>

                <form
                  className="space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleGuestLogin();
                  }}
                >
                  <input
                    type="text"
                    value={guestNickname}
                    onChange={(event) => setGuestNickname(event.target.value)}
                    maxLength={30}
                    placeholder="닉네임 입력"
                    className="w-full max-w-[330px] h-12 mx-auto block rounded-xl border border-gray-300 bg-white px-4 text-sm text-gray-900 outline-none focus:border-[#FF496D] focus:ring-2 focus:ring-[#FF496D]/15"
                  />
                  <button
                    type="submit"
                    disabled={!canSubmitGuest}
                    className={`w-full max-w-[330px] h-12 mx-auto rounded-xl text-sm font-semibold transition-all active:scale-[0.98] flex items-center justify-center ${
                      canSubmitGuest
                        ? 'bg-[#2B2D37] text-white hover:bg-[#1F2128]'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    가입 없이 이용하기
                  </button>
                </form>

                {!isAllAgreed && hasGuestNickname && (
                  <p className="mt-2 max-w-[330px] mx-auto text-xs leading-5 text-[#FF496D]">
                    서비스 이용약관과 개인정보 처리방침에 동의하면 가입 없이 이용할 수 있습니다.
                  </p>
                )}

                <p className="mt-3 max-w-[330px] mx-auto text-xs leading-5 text-gray-500">
                  작업 내용을 안전하게 보관하려면 회원가입 후 이용하는 것을 권장합니다.
                  쿠키 삭제, 브라우저 변경, 로그아웃 시 게스트 작업 접근이 어려울 수 있습니다.
                </p>
              </div>
            )}

            {error && (
              <p className="text-center text-red-500 text-sm mt-4 font-medium">{error}</p>
            )}
          </>
        ) : (
          /* 로딩 중일 때는 레이아웃 유지를 위한 빈 공간 */
          <div className="h-64" />
        )}
      </div>

      <LoadingOverlay isVisible={showOverlay} text={loadingText} />
    </div>
  );
}
