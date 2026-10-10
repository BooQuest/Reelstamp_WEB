'use client';

import { authFetch } from '@/app/lib/auth/browser-session';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock3, Loader2, Trash2 } from 'lucide-react';
import MyProjectThumbnail from '@/app/my-projects/MyProjectThumbnail';
import type { DraftProjectItem } from '@/app/my-projects/types';

type Props = {
  initialProjects: DraftProjectItem[];
  loadError: string | null;
  activeStatus: 'CAPTURE' | 'PROCESSING' | 'COMPLETED';
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

const expiryLabel = (value?: string | null) => {
  if (!value) return '';
  const remainingMs = new Date(value).getTime() - Date.now();
  if (remainingMs <= 0) return '곧 자동 삭제';
  const days = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
  return days <= 1 ? '내일 자동 삭제' : `${days}일 후 자동 삭제`;
};

const STATUS_TABS = [
  { status: 'CAPTURE', label: '제작 중' },
  { status: 'PROCESSING', label: '처리 중' },
  { status: 'COMPLETED', label: '제작 완료' },
] as const;

const PROJECT_SUFFIX = ' 프로젝트';

const resolveProjectDisplayTitle = (project: DraftProjectItem) => {
  const projectName = project.projectName?.trim();
  const templateTitle = project.templateTitle?.trim();
  if (projectName) {
    return templateTitle && projectName === `${templateTitle}${PROJECT_SUFFIX}`
      ? templateTitle
      : projectName;
  }
  return templateTitle || '릴스';
};

const buildReelsMakerHref = (
  templateId: string,
  sessionId: number,
  returnUrl: string
) =>
  `/reels-maker?templateId=${encodeURIComponent(templateId)}&sessionId=${sessionId}&returnUrl=${encodeURIComponent(returnUrl)}`;

export default function MyProjectsClient({
  initialProjects,
  loadError,
  activeStatus,
}: Props) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => { setProjects(initialProjects); }, [initialProjects]);
  useEffect(() => {
    if (activeStatus !== 'PROCESSING') return;
    const refresh = () => { if (document.visibilityState === 'visible') router.refresh(); };
    const timer = window.setInterval(refresh, 5000);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [activeStatus, router]);

  const openVideo = async (project: DraftProjectItem) => {
    const preview = window.open('about:blank', '_blank');
    if (preview) preview.opener = null;
    setOpeningId(project.sessionId);
    setNotice(null);
    try {
      const response = await authFetch(`/api/reels-maker/sessions/${project.sessionId}/status`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || !payload.success || payload.data?.status !== 'COMPLETED' || !payload.data.finalVideoUrl)
        throw new Error(payload.data?.mediaError || '완료 영상을 불러오지 못했습니다. 다시 시도해 주세요.');
      if (preview) preview.location.replace(payload.data.finalVideoUrl);
      else window.location.assign(payload.data.finalVideoUrl);
    } catch (error) {
      preview?.close();
      setNotice(error instanceof Error ? error.message : '영상 조회에 실패했습니다.');
    } finally { setOpeningId(null); }
  };
  const sortedProjects = useMemo(
    () =>
      [...projects].sort(
        (a, b) =>
          new Date(b.lastEditedAt || b.createdAt).getTime() -
          new Date(a.lastEditedAt || a.createdAt).getTime()
      ),
    [projects]
  );

  const deleteProject = async (project: DraftProjectItem) => {
    if (!window.confirm(`"${resolveProjectDisplayTitle(project)}"를 삭제할까요?`)) {
      return;
    }
    setDeletingId(project.sessionId);
    setNotice(null);
    try {
      const response = await authFetch(`/api/reels-maker/sessions/${project.sessionId}`, {
        method: 'DELETE',
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || '프로젝트 삭제에 실패했습니다.');
      }
      setProjects((prev) => prev.filter((item) => item.sessionId !== project.sessionId));
      setNotice('프로젝트를 삭제했습니다.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '프로젝트 삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0C111B] text-white">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">내 프로젝트</h1>
            <p className="mt-2 text-sm text-white/60">
              제작 중인 프로젝트는 마지막 저장일로부터 30일 동안 보관됩니다.
            </p>
          </div>
          <span className="shrink-0 whitespace-nowrap text-sm text-white/50">총 {projects.length}개</span>
        </div>

        <div className="mb-6 flex gap-2 rounded-2xl border border-white/10 bg-white/5 p-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.status}
              type="button"
              onClick={() => router.push(`/my-projects?status=${tab.status}`)}
              className={`h-10 flex-1 rounded-xl text-sm font-semibold transition ${
                activeStatus === tab.status
                  ? 'bg-[#FF4D6D] text-white'
                  : 'text-white/55 hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {notice && (
          <div className="mb-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/75">
            {notice}
          </div>
        )}
        {loadError && (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-6 text-sm text-rose-200">
            <p>{loadError}</p>
            <button type="button" onClick={() => router.refresh()} className="mt-3 underline">다시 시도</button>
          </div>
        )}
        {!loadError && projects.length === 0 && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-12 text-center">
            <p className="text-white/65">해당 상태의 프로젝트가 없습니다.</p>
            <button
              type="button"
              onClick={() => router.push('/all-templates')}
              className="mt-5 rounded-full bg-[#FF4D6D] px-5 py-3 text-sm font-semibold"
            >
              새 릴스 만들기
            </button>
          </div>
        )}

        {!loadError && sortedProjects.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sortedProjects.map((project) => {
              const progress =
                project.totalClipCount > 0
                  ? Math.round((project.completedClipCount / project.totalClipCount) * 100)
                  : 0;
              const displayTitle = resolveProjectDisplayTitle(project);
              return (
                <article
                  key={project.sessionId}
                  className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-lg"
                >
                  <div className="relative aspect-[3/2] bg-black">
                    <MyProjectThumbnail
                      projectThumbnailUrl={project.projectThumbnailUrl}
                      projectThumbnailContentType={project.projectThumbnailContentType}
                      projectThumbnailEdit={project.projectThumbnailEdit}
                      templateThumbnailUrl={project.templateThumbnailUrl}
                      alt={`${displayTitle} 썸네일`}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute inset-x-4 bottom-4">
                      <h2 className="truncate text-lg font-bold">
                        {displayTitle}
                      </h2>
                      <p className="mt-1 truncate text-xs text-white/65">
                        {project.templateTitle || '템플릿'}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4 p-5">
                    <div>
                      <div className="mb-2 flex justify-between text-xs text-white/60">
                        <span>
                          {project.completedClipCount}/{project.totalClipCount}컷 완료
                        </span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-[#FF4D6D]"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                    <div className="space-y-1 text-xs text-white/55">
                      <p>마지막 저장: {formatDateTime(project.lastEditedAt || project.createdAt)}</p>
                      {activeStatus === 'CAPTURE' && (
                        <p className="flex items-center gap-1 text-amber-200/80">
                          <Clock3 className="h-3.5 w-3.5" />
                          {expiryLabel(project.expiresAt)}
                        </p>
                      )}
                    </div>
                    {project.errorMessage && <p className="text-xs text-rose-200">{project.errorMessage}</p>}
                    {project.mediaError && <p className="text-xs text-amber-200">{project.mediaError}</p>}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (activeStatus === 'COMPLETED') {
                            void openVideo(project);
                            return;
                          }
                          const returnUrl = `/my-projects?status=${encodeURIComponent(activeStatus)}`;
                          router.push(
                            buildReelsMakerHref(project.templateId, project.sessionId, returnUrl)
                          );
                        }}
                        disabled={openingId === project.sessionId}
                        className="h-11 flex-1 rounded-full bg-[#FF4D6D] text-sm font-semibold disabled:opacity-50"
                      >
                        {activeStatus === 'CAPTURE'
                          ? '이어서 만들기'
                          : activeStatus === 'PROCESSING'
                            ? '처리 상태 보기'
                            : '영상 보기'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteProject(project)}
                        disabled={deletingId === project.sessionId}
                        className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-white/70 disabled:opacity-50"
                        aria-label="프로젝트 삭제"
                      >
                        {deletingId === project.sessionId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
