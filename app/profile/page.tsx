import { redirect } from 'next/navigation';
import { getCurrentUser, type WebApiResponse } from '@/app/lib/api/auth';
import { getServerApiClient } from '@/app/lib/api/server-client';
import ProfileClient from './ProfileClient';

export const dynamic = 'force-dynamic';

type ProfileStats = {
  completedReelsCount: number;
  savedTemplatesCount: number;
};

type CompletedReelsList = {
  reels?: unknown[];
  totalCount?: number;
};

type SavedTemplateList = {
  templates?: unknown[];
};

const EMPTY_PROFILE_STATS: ProfileStats = {
  completedReelsCount: 0,
  savedTemplatesCount: 0,
};

const summarizeApiError = (error: unknown) => {
  if (error instanceof Error) {
    const response = (error as { response?: { status?: number; data?: { message?: string } } })
      .response;
    return {
      message: error.message,
      status: response?.status ?? null,
      responseMessage: response?.data?.message ?? null,
    };
  }

  return {
    message: 'Unknown error',
    status: null,
    responseMessage: null,
  };
};

async function getProfileStats(): Promise<ProfileStats> {
  const apiClient = await getServerApiClient();

  const [completedReelsResult, savedTemplatesResult] = await Promise.allSettled([
    apiClient.get<WebApiResponse<CompletedReelsList>>(
      '/api/reels-maker/sessions?status=COMPLETED'
    ),
    apiClient.get<WebApiResponse<SavedTemplateList>>('/api/templates/saved'),
  ]);

  const completedReelsCount =
    completedReelsResult.status === 'fulfilled'
      ? completedReelsResult.value.data.data?.totalCount ??
        completedReelsResult.value.data.data?.reels?.length ??
        0
      : 0;

  const savedTemplatesCount =
    savedTemplatesResult.status === 'fulfilled'
      ? savedTemplatesResult.value.data.data?.templates?.length ?? 0
      : 0;

  if (completedReelsResult.status === 'rejected' || savedTemplatesResult.status === 'rejected') {
    console.error('[ProfilePage] 프로필 통계 조회 실패:', {
      completedReels:
        completedReelsResult.status === 'rejected'
          ? summarizeApiError(completedReelsResult.reason)
          : null,
      savedTemplates:
        savedTemplatesResult.status === 'rejected'
          ? summarizeApiError(savedTemplatesResult.reason)
          : null,
    });
  }

  return {
    completedReelsCount,
    savedTemplatesCount,
  };
}

export default async function ProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  let stats = EMPTY_PROFILE_STATS;

  try {
    stats = await getProfileStats();
  } catch (error) {
    console.error('[ProfilePage] 프로필 통계 API 클라이언트 생성 실패:', error);
  }

  return <ProfileClient initialUser={user} initialStats={stats} />;
}
