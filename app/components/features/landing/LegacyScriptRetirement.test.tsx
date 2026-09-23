import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import HeroSection from './HeroSection';
import BottomCTASection from './BottomCTASection';
import AdminPage from '@/app/admin/page';

const { replace, auth } = vi.hoisted(() => ({
  replace: vi.fn(),
  auth: { isAuthenticated: true, user: { role: 'ADMIN' } },
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/app/components/providers/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('@/app/components/features/admin/TemplateRequestStatsPanel', () => ({
  default: () => <div>현재 템플릿 요청 통계</div>,
}));

afterEach(() => {
  cleanup();
  replace.mockClear();
  auth.isAuthenticated = true;
  auth.user.role = 'ADMIN';
});

describe('legacy script retirement', () => {
  it('disables both legacy CTAs and explains the retirement', () => {
    const { container } = render(<><HeroSection /><BottomCTASection /></>);
    expect(screen.getByRole('button', { name: '지금 무료로 시작하기' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '지금 무료로 릴스탬프 시작하기' })).toBeDisabled();
    expect(screen.getAllByText('구형 AI 대본 제작 기능이 종료되었습니다.')).toHaveLength(2);
    expect(container.querySelector('a[href^="/contents"]')).toBeNull();
    expect(screen.getByRole('link', { name: /서비스 정식 출시 알람/ })).toHaveAttribute(
      'href', 'https://forms.gle/Sp2nQE9L7yx7k99b6',
    );
  });

  it('keeps template request statistics for administrators only', () => {
    render(<AdminPage />);
    expect(screen.getByText('현재 템플릿 요청 통계')).toBeInTheDocument();
    expect(screen.queryByText('대본 생성 이력')).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it.each([true, false])('does not render statistics for a non-admin (authenticated=%s)', (authenticated) => {
    auth.isAuthenticated = authenticated;
    auth.user.role = 'USER';
    render(<AdminPage />);
    expect(screen.queryByText('현재 템플릿 요청 통계')).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith('/');
  });
});
