import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/lib/api/auth';
import MyProjectsClient from '@/app/my-projects/MyProjectsClient';
import type { DraftProjectItem, DraftProjectListResponse } from '@/app/my-projects/types';

export const dynamic = 'force-dynamic';

export default async function MyProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?returnUrl=' + encodeURIComponent('/my-projects'));
  }

  const resolvedSearchParams = await searchParams;
  const requestedStatus = resolvedSearchParams.status?.toUpperCase();
  const activeStatus =
    requestedStatus === 'PROCESSING' || requestedStatus === 'COMPLETED'
      ? requestedStatus
      : 'CAPTURE';

  let projects: DraftProjectItem[] = [];
  let loadError: string | null = null;
  try {
    const { getServerApiClient } = await import('@/app/lib/api/server-client');
    const apiClient = await getServerApiClient();
    const response = await apiClient.get<DraftProjectListResponse>(
      `/api/reels-maker/sessions?status=${activeStatus}`
    );
    if (response.data?.success) {
      projects = response.data.data?.reels ?? [];
    } else {
      loadError = response.data?.message || '제작 중인 프로젝트를 불러오지 못했습니다.';
    }
  } catch {
    loadError = '제작 중인 프로젝트를 불러오지 못했습니다.';
  }

  return (
    <MyProjectsClient
      key={activeStatus}
      initialProjects={projects}
      loadError={loadError}
      activeStatus={activeStatus}
    />
  );
}
