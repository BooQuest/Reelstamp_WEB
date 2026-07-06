import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/lib/api/auth';
import CompletedReelActions from '@/app/completed-reels/CompletedReelActions';
import type {
  CompletedReelItem,
  CompletedReelsResponse,
} from '@/app/completed-reels/types';

export const dynamic = 'force-dynamic';

export default async function CompletedReelsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login?returnUrl=' + encodeURIComponent('/completed-reels'));
  }

  let reels: CompletedReelItem[] = [];
  let loadError: string | null = null;

  try {
    const { getServerApiClient } = await import('@/app/lib/api/server-client');
    const apiClient = await getServerApiClient();
    const response = await apiClient.get<CompletedReelsResponse>(
      '/api/reels-maker/sessions?status=COMPLETED'
    );

    if (response.data?.success && response.data.data?.reels) {
      reels = response.data.data.reels;
    } else {
      loadError = response.data?.message || '완료된 릴스를 불러오지 못했습니다.';
    }
  } catch (error: unknown) {
    const parsedError = error as {
      message?: string;
      response?: {
        status?: number;
        data?: unknown;
      };
    };
    console.error('[CompletedReelsPage] API 호출 실패:', {
      message: parsedError.message,
      status: parsedError.response?.status,
      data: parsedError.response?.data,
    });
    loadError = '완료된 릴스를 불러오지 못했습니다.';
  }

  return <CompletedReelActions initialReels={reels} loadError={loadError} />;
}
