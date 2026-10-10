import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import MyProjectsClient from './MyProjectsClient';
import { authFetch } from '@/app/lib/auth/browser-session';
import type { DraftProjectItem } from './types';
const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/app/lib/auth/browser-session', () => ({ authFetch: vi.fn() }));
vi.mock('@/app/my-projects/MyProjectThumbnail', () => ({ default: () => <div>thumbnail</div> }));
const project: DraftProjectItem = { sessionId: 10, templateId: 't', projectName: 'Saved reel', status: 'COMPLETED',
  finalVideoUrl: 'https://expired.example/video', completedClipCount: 3, totalClipCount: 3, createdAt: '2026-10-09T00:00:00Z' };
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); vi.useRealTimers(); });

it('gets a fresh video URL when opening a completed project', async () => {
  const popup = { opener: null, location: { replace: vi.fn() }, close: vi.fn() };
  vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
  vi.mocked(authFetch).mockResolvedValue(new Response(JSON.stringify({ success: true,
    data: { status: 'COMPLETED', finalVideoUrl: 'https://fresh.example/video' } })));
  render(<MyProjectsClient initialProjects={[project]} activeStatus="COMPLETED" loadError={null} />);
  fireEvent.click(screen.getByText('영상 보기'));
  await waitFor(() => expect(popup.location.replace).toHaveBeenCalledWith('https://fresh.example/video'));
});

it('keeps the card and shows a retryable video error when signing fails', async () => {
  vi.spyOn(window, 'open').mockReturnValue(null);
  vi.mocked(authFetch).mockResolvedValue(new Response(JSON.stringify({ success: true,
    data: { status: 'COMPLETED', finalVideoUrl: null, mediaError: '링크 발급 실패' } })));
  render(<MyProjectsClient initialProjects={[project]} activeStatus="COMPLETED" loadError={null} />);
  fireEvent.click(screen.getByText('영상 보기'));
  expect(await screen.findByText('링크 발급 실패')).toBeInTheDocument();
  expect(screen.getByText('Saved reel')).toBeInTheDocument();
});

it('refreshes processing projects while visible and applies refreshed server data', () => {
  vi.useFakeTimers();
  const { rerender } = render(<MyProjectsClient initialProjects={[project]} activeStatus="PROCESSING" loadError={null} />);
  act(() => vi.advanceTimersByTime(5000));
  expect(router.refresh).toHaveBeenCalledTimes(1);
  rerender(<MyProjectsClient initialProjects={[]} activeStatus="PROCESSING" loadError={null} />);
  expect(screen.queryByText('Saved reel')).not.toBeInTheDocument();
  expect(screen.getByText('해당 상태의 프로젝트가 없습니다.')).toBeInTheDocument();
});

it('shows failed projects with their reason in the capture tab', () => {
  render(<MyProjectsClient initialProjects={[{ ...project, status: 'FAILED', displayStatus: 'CAPTURE', errorMessage: '제작 실패: 다시 시도해 주세요.' }]}
    activeStatus="CAPTURE" loadError={null} />);
  expect(screen.getByText('제작 실패: 다시 시도해 주세요.')).toBeInTheDocument();
  expect(screen.getByText('이어서 만들기')).toBeInTheDocument();
});

it('keeps list errors distinct from empty lists and offers retry', () => {
  render(<MyProjectsClient initialProjects={[]} activeStatus="COMPLETED" loadError="제작 완료 프로젝트를 불러오지 못했습니다." />);
  expect(screen.queryByText('해당 상태의 프로젝트가 없습니다.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('다시 시도'));
  expect(router.refresh).toHaveBeenCalled();
});
