// 공통 헤더 컴포넌트: 브랜드 로고, 메뉴 영역, 가입/로그인 버튼을 포함하는 상단 네비게이션
'use client';

import { useState, useEffect, useCallback, useRef, type ComponentType } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/app/components/providers/AuthProvider';
import { USER_ROLES } from '@/app/lib/constants/auth';
import { User, Sparkles, LayoutTemplate, TrendingUp, Bookmark, CheckCircle, ChevronRight, ChevronLeft, Menu } from 'lucide-react';

// 메뉴 항목 타입 정의
interface MenuItem {
  href: string;
  label: string;
  matchPattern?: (pathname: string) => boolean;
  isExternal?: boolean;
  requiresAuth?: boolean;
}

interface MobileMenuItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  requiresAuth?: boolean;
}

// 메뉴 항목 상수
const MENU_ITEMS: MenuItem[] = [
  {
    href: '/contents/script-creation',
    label: '릴스 제작',
    matchPattern: (pathname) => pathname.startsWith('/contents'),
  },
  {
    href: '/ranking',
    label: '인기 급상승 릴스',
  },
];

const DESKTOP_MENU_ITEMS: MenuItem[] = [
  {
    href: '/templates',
    label: '맞춤형 릴스 추천',
  },
  {
    href: '/all-templates',
    label: '릴스 템플릿',
  },
  {
    href: '/trending-reels',
    label: '오늘의 릴스 트렌드',
    requiresAuth: true,
  },
  {
    href: '/contents/script-creation',
    label: '릴스 제작',
    matchPattern: (pathname) => pathname.startsWith('/contents'),
  },
  {
    href: '/ranking',
    label: '인기 급상승 릴스',
  },
];

const MOBILE_PRIMARY_ITEMS: MobileMenuItem[] = [
  {
    href: '/templates',
    label: '맞춤형 릴스 추천',
    icon: Sparkles,
  },
  {
    href: '/all-templates',
    label: '릴스 템플릿',
    icon: LayoutTemplate,
  },
  {
    href: '/trending-reels',
    label: '오늘의 릴스 트렌드',
    icon: TrendingUp,
    requiresAuth: true,
  },
  {
    href: '/saved-reels',
    label: '저장된 릴스',
    icon: Bookmark,
    requiresAuth: true,
  },
  {
    href: '/completed-reels',
    label: '제작 완료된 릴스',
    icon: CheckCircle,
    requiresAuth: true,
  },
];

const SIMPLE_HEADER_CONFIG: Record<string, { title: string; backHref: string }> = {
  '/reels-maker': { title: '릴스 제작', backHref: '/templates' },
  '/profile': { title: '내 정보', backHref: '/' },
  '/plan': { title: '이용 중인 플랜', backHref: '/profile' },
  '/account-settings': { title: '계정 설정', backHref: '/profile' },
  '/edit-profile': { title: '정보 수정', backHref: '/account-settings' },
  '/help': { title: '도움말', backHref: '/profile' },
  '/faq': { title: '자주 묻는 질문', backHref: '/help' },
  '/contact': { title: '문의하기', backHref: '/help' },
};

// 헤더 컴포넌트
export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, user, subscription } = useAuth();
  
  const isAdmin = user?.role?.toUpperCase() === USER_ROLES.ADMIN;
  
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const simpleHeader = SIMPLE_HEADER_CONFIG[pathname];
  const isDarkHeader = pathname === '/reels-maker';
  const buildLoginHref = (href: string) => `/login?returnUrl=${encodeURIComponent(href)}`;

  // 현재 경로가 메뉴와 일치하는지 확인하는 함수 (메모이제이션)
  const isActive = useCallback((item: MenuItem) => {
    if (item.matchPattern) {
      return item.matchPattern(pathname);
    }
    return pathname === item.href;
  }, [pathname]);

  // 스크롤 핸들러 (메모이제이션)
  const handleScroll = useCallback(() => {
    const currentScrollY = window.scrollY;

    // 스크롤이 맨 위에 있거나 위로 스크롤하면 헤더 표시
    if (currentScrollY < 10) {
      setIsVisible(true);
    } else if (currentScrollY > lastScrollY) {
      // 아래로 스크롤하면 헤더 숨김
      setIsVisible(false);
    } else {
      // 위로 스크롤하면 헤더 표시
      setIsVisible(true);
    }

    setLastScrollY(currentScrollY);
  }, [lastScrollY]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 모바일 메뉴 열림/닫힘 시 body 스크롤 제어
  useEffect(() => {
    if (isMobileMenuOpen) {
      // 메뉴가 열렸을 때: body 스크롤 잠금
      document.body.style.overflow = 'hidden';
    } else {
      // 메뉴가 닫혔을 때: body 스크롤 복원
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      // 컴포넌트 언마운트 시 스크롤 복원
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  // 프로필 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };

    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileMenuOpen]);

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-transform duration-300 ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      } ${isDarkHeader ? 'bg-black text-white' : 'bg-white'}`}
    >
      <div className="w-full pl-4 pr-4 sm:px-8 lg:px-12">
        {simpleHeader ? (
          <div className="flex items-center justify-between h-18">
            <Link
              href={simpleHeader.backHref}
              onClick={() => setIsMobileMenuOpen(false)}
              className={`w-10 h-10 flex items-center justify-center ${
                isDarkHeader ? 'text-white' : 'text-gray-700'
              }`}
              aria-label="뒤로가기"
            >
              <ChevronLeft className="w-6 h-6" />
            </Link>
            <h1
              className={`text-lg sm:text-xl font-bold ${
                isDarkHeader ? 'text-white' : 'text-gray-900'
              }`}
            >
              {simpleHeader.title}
            </h1>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`w-10 h-10 flex items-center justify-center ${
                isDarkHeader ? 'text-white' : 'text-gray-700'
              }`}
              aria-label="메뉴"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between h-18">
            {/* 좌측: 브랜드 로고 (타이포그래피) */}
            <div className="flex items-center">
              <Link 
                href="/" 
                className="flex items-center gap-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <span 
                  className="text-[26px] md:text-[32px] font-bold leading-[150%] tracking-[-0.05em]"
                  style={{ 
                    fontFamily: 'Helvetica, Arial, sans-serif',
                    color: '#FF496D',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  Reelstamp
                </span>
                <span 
                  className="beta-text text-[22px] md:text-[26px] font-normal leading-[150%] tracking-[-0.03em]"
                  style={{ 
                    fontFamily: 'var(--font-praise), serif',
                    background: 'linear-gradient(180deg, #FFB4C7 0%, #FF496D 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  Beta
                </span>
              </Link>
            </div>

            {/* 중앙: 메뉴 영역 (PC) */}
            <nav className="hidden md:flex items-center gap-10">
              {DESKTOP_MENU_ITEMS.map((item) => {
                const active = isActive(item);
                const targetHref =
                  !isAuthenticated && item.requiresAuth && !item.isExternal
                    ? buildLoginHref(item.href)
                    : item.href;
                return (
                  <Link
                    key={item.href}
                    href={targetHref}
                    target={item.isExternal ? '_blank' : undefined}
                    rel={item.isExternal ? 'noopener noreferrer' : undefined}
                    className={`text-lg transition-colors ${
                      active
                        ? 'text-[#FF496D] font-extrabold'
                        : 'text-gray-700 hover:text-gray-900 font-medium'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
              {/* Admin 메뉴 (ADMIN role만 표시) */}
              {isAuthenticated && isAdmin && (
                <Link
                  href="/admin"
                  className={`text-lg transition-colors ${
                    pathname.startsWith('/admin')
                      ? 'text-[#FF496D] font-extrabold'
                      : 'text-gray-700 hover:text-gray-900 font-medium'
                  }`}
                >
                  관리자
                </Link>
              )}
            </nav>

            {/* 우측: 가입/로그인 버튼 및 모바일 메뉴 */}
            <div className="flex items-center gap-3">
              {/* 영상 횟수 UI (모바일) */}
              {isAuthenticated && subscription && (
              <div className="md:hidden flex items-center gap-3 px-3 py-1.5 bg-white border border-gray-200 rounded-lg">
                {/* 재생 버튼 아이콘 */}
                <div className="w-5 h-5 bg-[#FF496D] rounded flex items-center justify-center flex-shrink-0">
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-0.5">
                    <path d="M2 1L6 4L2 7V1Z" fill="white" />
                  </svg>
                </div>
                {/* 숫자 */}
                  <span className="text-base font-medium text-[#FF496D]">
                    {subscription.videoSessionUsage?.unlimited 
                      ? '∞' 
                      : subscription.videoSessionUsage?.remaining ?? 0}
                  </span>
              </div>
              )}
              {/* 모바일 햄버거 메뉴 버튼 */}
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-1.5 rounded-lg bg-gradient-to-r from-[#EB48B1] to-[#F59A39] hover:from-[#D93D9F] hover:to-[#E6892F] transition-all shadow-sm hover:shadow-md"
                aria-label="메뉴"
              >
                <div className="w-5 h-4 flex flex-col justify-between items-end">
                  <motion.span
                    className="block h-[2px] bg-white rounded-full"
                    style={{ width: isMobileMenuOpen ? '100%' : '75%' }}
                    animate={isMobileMenuOpen ? { rotate: 45, y: 6.5, width: '100%' } : { rotate: 0, y: 0, width: '75%' }}
                    transition={{ duration: 0.2 }}
                  />
                  <motion.span
                    className="block h-[2px] bg-white rounded-full"
                    style={{ width: '100%' }}
                    animate={isMobileMenuOpen ? { opacity: 0 } : { opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  />
                  <motion.span
                    className="block h-[2px] bg-white rounded-full"
                    style={{ width: isMobileMenuOpen ? '100%' : '50%' }}
                    animate={isMobileMenuOpen ? { rotate: -45, y: -6.5, width: '100%' } : { rotate: 0, y: 0, width: '50%' }}
                    transition={{ duration: 0.2 }}
                  />
                </div>
              </button>
              {/* 로그인/회원가입 또는 프로필 이미지 (PC만 표시) */}
              <div className="hidden md:flex items-center gap-6">
                {/* 영상 횟수 UI (PC) */}
                {isAuthenticated && subscription && (
                <div className="flex items-center gap-4 px-4 py-2 bg-white border border-gray-200 rounded-lg min-w-[80px]">
                  {/* 재생 버튼 아이콘 */}
                  <div className="w-5 h-5 bg-[#FF496D] rounded flex items-center justify-center flex-shrink-0">
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-0.5">
                      <path d="M2 1L6 4L2 7V1Z" fill="white" />
                    </svg>
                  </div>
                  {/* 숫자 */}
                    <span className="text-base font-medium text-[#FF496D]">
                      {subscription.videoSessionUsage?.unlimited 
                        ? '∞' 
                        : subscription.videoSessionUsage?.remaining ?? 0}
                    </span>
                </div>
                )}
                {isAuthenticated ? (
                  // 로그인 상태: 프로필 이미지 (클릭 시 메뉴 표시)
                  <div className="relative" ref={profileMenuRef}>
                    <button
                      onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                      className="relative w-10 h-10 rounded-full overflow-hidden transition-all hover:ring-2 hover:ring-gray-300 flex items-center justify-center bg-gray-100 border-2 border-gray-200 shadow-sm hover:shadow-md"
                      aria-label="프로필 메뉴"
                    >
                      {user?.profileImageUrl ? (
                        <Image
                          src={user.profileImageUrl}
                          alt="프로필"
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <User className="w-5 h-5 text-gray-400" />
                      )}
                    </button>

                    {/* 프로필 메뉴 팝업 */}
                    <AnimatePresence>
                      {isProfileMenuOpen && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          transition={{ duration: 0.2 }}
                          className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50"
                        >
                          {/* 유저 정보 섹션 */}
                          <div className="px-4 py-4 bg-gray-50 border-b border-gray-200">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-gray-100 border-2 border-gray-200">
                                {user?.profileImageUrl ? (
                                  <Image
                                    src={user.profileImageUrl}
                                    alt="프로필"
                                    width={48}
                                    height={48}
                                    className="w-full h-full object-cover"
                                    unoptimized
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-200 to-orange-200">
                                    <span className="text-lg font-semibold text-gray-700">
                                      {user?.nickname?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-base font-semibold text-gray-900 truncate">
                                  {user?.nickname || user?.socialNickname || '사용자'}
                                </p>
                                {user?.email && (
                                  <p className="text-sm text-gray-500 truncate">{user.email}</p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* 메뉴 항목 */}
                          <div className="py-2">
                            <button
                              onClick={() => {
                                setIsProfileMenuOpen(false);
                                router.push('/profile');
                              }}
                              className="w-full px-4 py-3 flex items-center gap-3 text-left text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <User className="w-5 h-5 text-gray-400" />
                              <span className="text-base font-medium">내 정보</span>
                            </button>

                            <div className="border-t border-gray-200 my-1"></div>

                            <Link
                              href="/templates"
                              onClick={() => setIsProfileMenuOpen(false)}
                              className="w-full px-4 py-3 flex items-center gap-3 text-left text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <Sparkles className="w-5 h-5 text-gray-400" />
                              <span className="text-base font-medium">맞춤형 릴스 추천</span>
                            </Link>
                            <Link
                              href="/all-templates"
                              onClick={() => setIsProfileMenuOpen(false)}
                              className="w-full px-4 py-3 flex items-center gap-3 text-left text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <LayoutTemplate className="w-5 h-5 text-gray-400" />
                              <span className="text-base font-medium">릴스 템플릿</span>
                            </Link>
                            <Link
                              href="/trending-reels"
                              onClick={() => setIsProfileMenuOpen(false)}
                              className="w-full px-4 py-3 flex items-center gap-3 text-left text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <TrendingUp className="w-5 h-5 text-gray-400" />
                              <span className="text-base font-medium">오늘의 릴스 트렌드</span>
                            </Link>

                            <div className="border-t border-gray-200 my-1"></div>

                            <Link
                              href="/saved-reels"
                              onClick={() => setIsProfileMenuOpen(false)}
                              className="w-full px-4 py-3 flex items-center gap-3 text-left text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <Bookmark className="w-5 h-5 text-gray-400" />
                              <span className="text-base font-medium">저장된 릴스</span>
                            </Link>
                            <Link
                              href="/completed-reels"
                              onClick={() => setIsProfileMenuOpen(false)}
                              className="w-full px-4 py-3 flex items-center gap-3 text-left text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <CheckCircle className="w-5 h-5 text-gray-400" />
                              <span className="text-base font-medium">제작 완료된 릴스</span>
                            </Link>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  // 비로그인 상태: 로그인/회원가입 버튼
                  <Link
                    href="/login"
                    className="px-5 py-2 text-base font-medium text-white rounded-xl transition-all hover:bg-[#1F2128] hover:shadow-lg flex items-center justify-center"
                    style={{ backgroundColor: '#2B2D37' }}
                    aria-label="로그인/회원가입"
                  >
                    로그인/회원가입
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 모바일 메뉴 (전체 화면) - Portal로 body에 직접 렌더링 */}
      {mounted && createPortal(
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
                className={`fixed top-[72px] left-0 right-0 bottom-0 z-[9999] bg-white ${simpleHeader ? '' : 'md:hidden'}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <nav className="h-full flex flex-col overflow-y-auto">
                  {/* 로그인 상태: 유저 정보 섹션 (클릭 시 내 정보 페이지 이동) */}
                  {isAuthenticated && user && (
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        router.push('/profile');
                      }}
                      className="w-full px-6 pt-6 pb-4 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 bg-gray-100 border-2 border-gray-200">
                          {user.profileImageUrl ? (
                            <Image
                              src={user.profileImageUrl}
                              alt="프로필"
                              width={56}
                              height={56}
                              className="w-full h-full object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-200 to-orange-200">
                              <span className="text-xl font-semibold text-gray-700">
                                {user.nickname?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-semibold text-gray-900 truncate">
                            {user.nickname || user.socialNickname || '사용자'}
                          </p>
                          {user.email && (
                            <p className="text-sm text-gray-500 truncate">{user.email}</p>
                          )}
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      </div>
                    </button>
                  )}

                  <div className="flex-1 flex flex-col p-6">
                    {!isAuthenticated && (
                      <Link
                        href="/login"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="w-full mb-4 px-5 py-3 text-base font-semibold text-white rounded-xl transition-all hover:bg-[#FF496D]/90 text-center"
                        style={{ backgroundColor: '#FF496D' }}
                        aria-label="로그인/회원가입"
                      >
                        로그인 / 회원가입
                      </Link>
                    )}

                    <div className="flex flex-col space-y-2">
                      {/* 신규 메뉴 */}
                      {MOBILE_PRIMARY_ITEMS.slice(0, 3).map((item) => {
                        const active = pathname === item.href;
                        const Icon = item.icon;
                        const targetHref =
                          !isAuthenticated && item.requiresAuth ? buildLoginHref(item.href) : item.href;
                        return (
                          <Link
                            key={item.href}
                            href={targetHref}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={`w-full flex items-center gap-3 px-5 py-3.5 text-lg rounded-xl transition-colors ${
                              active
                                ? 'text-[#FF496D] font-extrabold bg-[#FF496D]/10 shadow-sm'
                                : 'text-gray-900 font-medium hover:bg-gray-50'
                            }`}
                          >
                            <Icon className="w-5 h-5 text-gray-600" />
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}

                      <div className="border-t border-gray-200 my-2"></div>

                      {MOBILE_PRIMARY_ITEMS.slice(3).map((item) => {
                        const active = pathname === item.href;
                        const Icon = item.icon;
                        const targetHref =
                          !isAuthenticated && item.requiresAuth ? buildLoginHref(item.href) : item.href;
                        return (
                          <Link
                            key={item.href}
                            href={targetHref}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={`w-full flex items-center gap-3 px-5 py-3.5 text-lg rounded-xl transition-colors ${
                              active
                                ? 'text-[#FF496D] font-extrabold bg-[#FF496D]/10 shadow-sm'
                                : 'text-gray-900 font-medium hover:bg-gray-50'
                            }`}
                          >
                            <Icon className="w-5 h-5 text-gray-600" />
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}

                      <div className="border-t border-gray-200 my-2"></div>

                      {/* 기존 메뉴 */}
                      {MENU_ITEMS.map((item) => {
                        const active = isActive(item);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            target={item.isExternal ? '_blank' : undefined}
                            rel={item.isExternal ? 'noopener noreferrer' : undefined}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={`w-full block px-5 py-3.5 text-lg rounded-xl transition-colors ${
                              active
                                ? 'text-[#FF496D] font-extrabold bg-[#FF496D]/10 shadow-sm'
                                : 'text-gray-900 font-medium hover:bg-gray-50'
                            }`}
                          >
                            {item.label}
                          </Link>
                        );
                      })}
                      {/* Admin 메뉴 (ADMIN role만 표시) */}
                      {isAuthenticated && isAdmin && (
                        <Link
                          href="/admin"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={`w-full block px-5 py-3.5 text-lg rounded-xl transition-colors ${
                            pathname.startsWith('/admin')
                              ? 'text-[#FF496D] font-extrabold bg-[#FF496D]/10 shadow-sm'
                              : 'text-gray-900 font-medium hover:bg-gray-50'
                          }`}
                        >
                          관리자
                        </Link>
                      )}
                    </div>
                  </div>
                </nav>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

    </header>
  );
}
