import { redirect } from 'next/navigation';
import Image from 'next/image';
import { getCurrentUser } from '@/app/lib/api/auth';
import type { WebApiResponse } from '@/app/lib/api/auth';

export const dynamic = 'force-dynamic';

type CompletedReelItem = {
  sessionId: number;
  templateId: string;
  templateTitle?: string | null;
  templateThumbnailUrl?: string | null;
  status: string;
  finalVideoUrl?: string | null;
  createdAt: string;
};

type CompletedReelsList = {
  reels: CompletedReelItem[];
  totalCount: number;
};

type CompletedReelsResponse = WebApiResponse<CompletedReelsList>;

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}

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
  } catch (error: any) {
    console.error('[CompletedReelsPage] API 호출 실패:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    loadError = '완료된 릴스를 불러오지 못했습니다.';
  }

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0C111B] text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">제작 완료된 릴스</h1>
            <p className="text-sm text-white/60 mt-2">
              지금까지 제작한 릴스를 한눈에 확인하세요.
            </p>
          </div>
          <div className="text-sm text-white/60">총 {reels.length}개</div>
        </div>

        {loadError && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
            {loadError}
          </div>
        )}

        {!loadError && reels.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-sm text-white/70">
            아직 제작 완료된 릴스가 없습니다.
          </div>
        )}

        {!loadError && reels.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {reels.map((reel) => (
              <div
                key={reel.sessionId}
                className="rounded-3xl border border-white/10 bg-white/5 overflow-hidden shadow-lg"
              >
                <div className="relative w-full aspect-[3/4] bg-black">
                  {reel.templateThumbnailUrl ? (
                    <Image
                      src={reel.templateThumbnailUrl}
                      alt={reel.templateTitle || '릴스 썸네일'}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-white/40">
                      썸네일 없음
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="text-base font-semibold truncate">
                      {reel.templateTitle || '템플릿'}
                    </h3>
                    <p className="text-xs text-white/70 mt-1">
                      {formatDate(reel.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="p-4 flex items-center justify-between text-sm">
                  <span className="text-white/60">상태: {reel.status}</span>
                  {reel.finalVideoUrl ? (
                    <a
                      href={reel.finalVideoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-[#FF4D6D] px-4 py-2 text-xs font-semibold"
                    >
                      영상 보기
                    </a>
                  ) : (
                    <span className="text-xs text-white/40">영상 없음</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
