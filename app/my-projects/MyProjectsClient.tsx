'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock3, Loader2, Trash2 } from 'lucide-react';
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
  const [notice, setNotice] = useState<string | null>(null);
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
    if (!window.confirm(`"${project.projectName || project.templateTitle || '릴스 프로젝트'}"를 삭제할까요?`)) {
      return;
    }
    setDeletingId(project.sessionId);
    setNotice(null);
    try {
      const response = await fetch(`/api/reels-maker/sessions/${project.sessionId}`, {
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
          <span className="text-sm text-white/50">총 {projects.length}개</span>
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
            {loadError}
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
              return (
                <article
                  key={project.sessionId}
                  className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-lg"
                >
                  <div className="relative aspect-[3/2] bg-black">
                    {project.templateThumbnailUrl ? (
                      <Image
                        src={project.templateThumbnailUrl}
                        alt=""
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-white/35">
                        썸네일 없음
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute inset-x-4 bottom-4">
                      <h2 className="truncate text-lg font-bold">
                        {project.projectName || `${project.templateTitle || '릴스'} 프로젝트`}
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
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (activeStatus === 'COMPLETED' && project.finalVideoUrl) {
                            window.open(project.finalVideoUrl, '_blank', 'noopener,noreferrer');
                            return;
                          }
                          const returnUrl = `/my-projects?status=${encodeURIComponent(activeStatus)}`;
                          router.push(
                            buildReelsMakerHref(project.templateId, project.sessionId, returnUrl)
                          );
                        }}
                        className="h-11 flex-1 rounded-full bg-[#FF4D6D] text-sm font-semibold"
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
