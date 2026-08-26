'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { loginAsGuestAction, loginWithSocialAction } from '@/app/actions/auth';
import { useAuth } from '@/app/components/providers/AuthProvider';
import LoadingOverlay from '@/app/components/ui/LoadingOverlay';
import type { SocialAuthProvider } from '@/app/lib/api/auth';
import {
  buildLoginOauthState,
  clearStoredLoginReturnUrl,
  consumeStoredLoginReturnUrl,
  getLoginReturnUrlFromSearchParams,
  getStoredLoginReturnUrl,
  LOGIN_HOME_PATH,
  parseLoginOauthState,
  storeLoginReturnUrl,
  type LoginOAuthStatePrefix,
} from '@/app/lib/auth/loginRedirect';

type OAuthTokenResponse = {
  access_token?: string;
  error_description?: string;
  message?: string;
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
        normalizedMessage.includes('econnrefused') ||
        normalizedMessage.includes('econnreset') ||
        normalizedMessage.includes('enotfound') ||
        normalizedMessage.includes('etimedout') ||
        normalizedMessage.includes('network error') ||
        normalizedMessage.includes('fetch failed') ||
        normalizedMessage.includes('socket hang up') ||
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
  const [isGuestStep, setIsGuestStep] = useState(false);
  const [guestNickname, setGuestNickname] = useState('');
  const isGuestUser = Boolean(user?.guest || user?.provider === 'GUEST');
  const isSocialAuthenticated = isAuthenticated && !isGuestUser;

  // 초기 마운트 시 mounted 상태 설정
  useEffect(() => {
    setMounted(true);
  }, []);

  const createOauthNonce = () => {
    return (
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2, 12)
    );
  };

  const prepareOauthState = (prefix: LoginOAuthStatePrefix) => {
    const state = buildLoginOauthState(prefix, createOauthNonce(), getStoredLoginReturnUrl());
    sessionStorage.setItem('oauth_state', state);
    return state;
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const returnUrlParam = getLoginReturnUrlFromSearchParams(urlParams);

    if (returnUrlParam) {
      storeLoginReturnUrl(returnUrlParam);
    } else if (!returnUrlParam && !code) {
      clearStoredLoginReturnUrl();
    }

    if (code && !isProcessing && !isSocialAuthenticated) {
      setIsProcessing(true);
      
      const cleanUrl = window.location.pathname + (returnUrlParam ? `?returnUrl=${encodeURIComponent(returnUrlParam)}` : '');
      window.history.replaceState({}, '', cleanUrl);

      const parsedState = parseLoginOauthState(state);
      const storedProvider = sessionStorage.getItem('oauth_provider') as
        | 'KAKAO'
        | 'NAVER'
        | 'GOOGLE'
        | null;
      const storedState = sessionStorage.getItem('oauth_state');

      const inferredProvider =
        storedProvider ||
        parsedState?.provider ||
        'KAKAO';

      const requiresState =
        inferredProvider === 'KAKAO' || inferredProvider === 'NAVER' || inferredProvider === 'GOOGLE';
      if (requiresState) {
        if (!state) {
          setError('로그인 state 정보가 누락되었습니다. 다시 시도해주세요.');
          setIsProcessing(false);
          return;
        }
      }
      if (state && storedState && state !== storedState) {
        setError('로그인 state 검증에 실패했습니다. 다시 시도해주세요.');
        setIsProcessing(false);
        return;
      }

      if (parsedState?.returnUrl) {
        storeLoginReturnUrl(parsedState.returnUrl);
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
  }, [isProcessing, isSocialAuthenticated]);

  // [카카오] 인가 코드를 액세스 토큰으로 교환
  const handleKakaoCode = async (code: string) => {
    setIsLoadingKakao(true);
    setLoadingText('카카오 로그인 처리 중...');
    setError(null);
    try {
      const redirectUri = `${window.location.origin}/login`;
      const tokenResponse = await fetch('/api/auth/kakao-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirectUri }),
      });

      const tokenData = (await tokenResponse.json()) as OAuthTokenResponse;
      if (!tokenResponse.ok || !tokenData.access_token) {
        throw new Error(tokenData.message || tokenData.error_description || '카카오 토큰 교환 실패');
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
        router.replace(consumeStoredLoginReturnUrl() ?? LOGIN_HOME_PATH);
      } catch (pushError) {
        console.error('[processLogin] 리다이렉트 실패:', pushError);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, '로그인 처리 중 오류가 발생했습니다.'));
      setLoading(false);
    }
  };

  const hasGuestNickname = Boolean(guestNickname.trim());
  const canSubmitGuest = hasGuestNickname && !isLoadingGuest;

  const handleStartGuestStep = () => {
    if (isGuestUser) {
      router.replace(consumeStoredLoginReturnUrl() ?? LOGIN_HOME_PATH);
      return;
    }

    setError(null);
    setIsGuestStep(true);
  };

  const handleGuestLogin = async () => {
    if (isGuestUser) return;

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

      const redirectPath = consumeStoredLoginReturnUrl() ?? LOGIN_HOME_PATH;
      window.location.replace(redirectPath);
    } catch (err: unknown) {
      setError(getErrorMessage(err, '가입 없이 이용하기 처리 중 오류가 발생했습니다.'));
    } finally {
      setIsLoadingGuest(false);
    }
  };

  // 카카오 로그인 핸들러
  const handleKakaoLogin = () => {
    setIsLoadingKakao(true);
    setLoadingText('카카오 로그인 중...');
    setError(null);
    sessionStorage.setItem('oauth_provider', 'KAKAO');
    const state = prepareOauthState('kakao');
    const redirectUri = `${window.location.origin}/login`;
    const kakaoAuthUrl = new URL('/api/auth/kakao-authorize', window.location.origin);

    kakaoAuthUrl.searchParams.set('redirectUri', redirectUri);
    kakaoAuthUrl.searchParams.set('state', state);
    window.location.href = kakaoAuthUrl.toString();
  };

  // 네이버 로그인 핸들러
  const handleNaverLogin = () => {
    const clientId = process.env.NEXT_PUBLIC_NAVER_CLIENT_ID;
    if (!clientId) {
      setError('네이버 API 키가 설정되지 않았습니다.');
      return;
    }

    const redirectUri = encodeURIComponent(`${window.location.origin}/login`);
    const state = prepareOauthState('naver');
    
    setIsLoadingNaver(true);
    setLoadingText('네이버 로그인 중...');
    setError(null);
    sessionStorage.setItem('oauth_provider', 'NAVER');

    const naverAuthUrl = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=${encodeURIComponent(state)}`;
    window.location.href = naverAuthUrl;
  };

  // 구글 로그인 핸들러
  const handleGoogleLogin = () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setError('구글 클라이언트 ID가 설정되지 않았습니다.');
      return;
    }

    const redirectUri = `${window.location.origin}/login`;
    const state = prepareOauthState('google');
    const scope = encodeURIComponent('openid email profile');

    setIsLoadingGoogle(true);
    setLoadingText('구글 로그인 중...');
    setError(null);
    sessionStorage.setItem('oauth_provider', 'GOOGLE');

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
                3분만에 만드는 트렌드 마케팅 릴스
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

            {isGuestStep && !isGuestUser ? (
              <div className="w-full max-w-[330px] mx-auto">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setIsGuestStep(false);
                  }}
                  className="mb-5 inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
                  aria-label="로그인 방법 선택으로 돌아가기"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  로그인 방법 선택
                </button>

                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleGuestLogin();
                  }}
                >
                  <label htmlFor="guest-nickname" className="block text-sm font-semibold text-gray-900">
                    닉네임
                  </label>
                  <input
                    id="guest-nickname"
                    type="text"
                    value={guestNickname}
                    onChange={(event) => {
                      setGuestNickname(event.target.value);
                      if (error) {
                        setError(null);
                      }
                    }}
                    maxLength={30}
                    placeholder="닉네임 입력"
                    className="block h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-base text-gray-900 outline-none focus:border-[#FF496D] focus:ring-2 focus:ring-[#FF496D]/15 sm:text-sm"
                  />

                  {error && (
                    <p className="text-center text-sm font-medium text-red-500" role="alert">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={!canSubmitGuest}
                    className={`flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
                      canSubmitGuest
                        ? 'bg-[#2B2D37] text-white hover:bg-[#1F2128]'
                        : 'cursor-not-allowed bg-gray-200 text-gray-400'
                    }`}
                  >
                    시작하기
                  </button>

                  <p className="text-xs leading-5 text-gray-500">
                    작업 내용을 안전하게 보관하려면 회원가입 후 이용하는 것을 권장합니다.
                    쿠키 삭제, 브라우저 변경, 로그아웃 시 게스트 작업 접근이 어려울 수 있습니다.
                  </p>
                </form>
              </div>
            ) : (
              <>
                <div className="space-y-2 md:space-y-3">
                  <button
                    type="button"
                    className="h-14 w-full transition-all active:scale-[0.98]"
                    aria-label="로그인 없이 이용하기"
                    onClick={handleStartGuestStep}
                  >
                    <span className="mx-auto flex h-full w-full max-w-[330px] items-center justify-center rounded-xl bg-[#2B2D37] text-base font-semibold text-white transition-colors hover:bg-[#1F2128]">
                      로그인 없이 이용하기
                    </span>
                  </button>

                  <button
                    type="button"
                    className="h-14 w-full transition-all active:scale-[0.98]"
                    aria-label="구글로 로그인"
                    onClick={handleGoogleLogin}
                  >
                    <span className="mx-auto flex h-full w-full max-w-[330px] items-center justify-center gap-3 rounded-xl border-2 border-gray-300 bg-white">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      <span className="font-semibold text-gray-700">구글로 로그인</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    className="flex h-14 w-full justify-center rounded-xl transition-all active:scale-[0.98] hover:opacity-90"
                    aria-label="네이버로 로그인"
                    onClick={handleNaverLogin}
                  >
                    <Image
                      src="/images/login_naver.png"
                      alt="네이버로 로그인"
                      width={400}
                      height={56}
                      className="h-full w-full max-w-[330px] rounded-xl object-contain"
                      priority
                    />
                  </button>

                  <button
                    type="button"
                    className="flex h-14 w-full justify-center rounded-xl transition-all active:scale-[0.98] hover:opacity-90"
                    aria-label="카카오톡으로 로그인"
                    onClick={handleKakaoLogin}
                  >
                    <Image
                      src="/images/login_kakao.png"
                      alt="카카오톡으로 로그인"
                      width={400}
                      height={56}
                      className="h-full w-full max-w-[330px] rounded-xl object-contain"
                      priority
                    />
                  </button>
                </div>

                <p className="mx-auto mt-5 max-w-[330px] text-center text-xs leading-5 text-gray-500">
                  로그인하면{' '}
                  <a
                    href="/terms-of-service"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-[#FF496D] hover:underline"
                  >
                    서비스 이용약관
                  </a>
                  {' '}및{' '}
                  <a
                    href="/privacy-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-[#FF496D] hover:underline"
                  >
                    개인정보 처리방침
                  </a>
                  에 동의한 것으로 간주됩니다.
                </p>
              </>
            )}

            {error && !isGuestStep && (
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
