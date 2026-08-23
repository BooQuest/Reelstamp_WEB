import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight, User, X } from 'lucide-react';
import type { UserInfo } from '@/app/lib/api/auth';
import {
  CAPTURE_MENU_ITEMS,
  SHOW_DISABLED_CAPTURE_MENU_ITEMS,
  isCaptureMenuItemVisible,
} from '../config';

type Props = {
  user: UserInfo | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isGuestUser: boolean;
  isRegisteredUser: boolean;
  loginHref: string;
  onClose: () => void;
  onRequestExit: (href: string) => void;
};

export default function CaptureMenu({
  user,
  isAuthenticated,
  isAdmin,
  isGuestUser,
  isRegisteredUser,
  loginHref,
  onClose,
  onRequestExit,
}: Props) {
  const requestExit = (href: string) => {
    onClose();
    onRequestExit(href);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-white text-gray-900">
      <nav
        className="flex h-full flex-col overflow-y-auto"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 px-5">
          <span className="text-lg font-bold">메뉴</span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700"
            aria-label="메뉴 닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isAuthenticated && user && (
          <button
            type="button"
            onClick={() => requestExit('/profile')}
            className="w-full border-b border-gray-200 bg-gray-50 px-6 py-4 text-left transition hover:bg-gray-100"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-gray-200 bg-gray-100">
                {user.profileImageUrl ? (
                  <Image
                    src={user.profileImageUrl}
                    alt="프로필"
                    width={56}
                    height={56}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  <User className="h-6 w-6 text-gray-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold">
                  {user.nickname || user.socialNickname || '사용자'}
                </p>
                {user.email && (
                  <p className="truncate text-sm text-gray-500">{user.email}</p>
                )}
                {!user.email && isGuestUser && (
                  <p className="truncate text-sm text-gray-500">가입 없이 이용 중</p>
                )}
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" />
            </div>
          </button>
        )}

        <div className="flex-1 space-y-2 p-6">
          {isRegisteredUser && (
            <button
              type="button"
              onClick={() => requestExit('/my-projects')}
              className="mb-4 flex w-full items-center justify-center rounded-xl bg-[#FF496D] px-5 py-3 text-base font-semibold text-white"
            >
              저장 후 나가기
            </button>
          )}
          {isGuestUser && (
            <Link
              href={loginHref}
              onClick={onClose}
              className="mb-4 flex w-full items-center justify-center rounded-xl bg-[#FF496D] px-5 py-3 text-base font-semibold text-white"
            >
              회원가입하고 보관하기
            </Link>
          )}
          {!isAuthenticated && (
            <Link
              href={loginHref}
              onClick={onClose}
              className="mb-4 flex w-full items-center justify-center rounded-xl bg-[#FF496D] px-5 py-3 text-base font-semibold text-white"
            >
              로그인 / 회원가입
            </Link>
          )}

          {CAPTURE_MENU_ITEMS
            .filter(isCaptureMenuItemVisible)
            .filter((item) => !item.requiresAuth || isAuthenticated)
            .map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={(event) => {
                    event.preventDefault();
                    requestExit(item.href);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-5 py-3.5 text-lg font-medium text-gray-900 transition hover:bg-gray-50"
                >
                  <Icon className="h-5 w-5 text-gray-600" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

          {(SHOW_DISABLED_CAPTURE_MENU_ITEMS || (isAuthenticated && isAdmin)) && (
            <div className="my-2 border-t border-gray-200" />
          )}

          {SHOW_DISABLED_CAPTURE_MENU_ITEMS && (
            <>
              <Link
                href="/contents/script-creation"
                onClick={(event) => {
                  event.preventDefault();
                  requestExit('/contents/script-creation');
                }}
                className="block w-full rounded-xl px-5 py-3.5 text-lg font-medium text-gray-900 transition hover:bg-gray-50"
              >
                릴스 제작
              </Link>
              <Link
                href="/ranking"
                onClick={(event) => {
                  event.preventDefault();
                  requestExit('/ranking');
                }}
                className="block w-full rounded-xl px-5 py-3.5 text-lg font-medium text-gray-900 transition hover:bg-gray-50"
              >
                인기 급상승 릴스
              </Link>
            </>
          )}

          {isAuthenticated && isAdmin && (
            <Link
              href="/admin"
              onClick={(event) => {
                event.preventDefault();
                requestExit('/admin');
              }}
              className="block w-full rounded-xl px-5 py-3.5 text-lg font-medium text-gray-900 transition hover:bg-gray-50"
            >
              관리자
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}
