import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/lib/api/auth';
import RankingPage from '@/app/ranking/page';

export const dynamic = 'force-dynamic';

export default async function TrendingReelsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login?returnUrl=' + encodeURIComponent('/trending-reels'));
  }

  return <RankingPage />;
}
