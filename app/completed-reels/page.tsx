import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/lib/api/auth';

export const dynamic = 'force-dynamic';

export default async function CompletedReelsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login?returnUrl=' + encodeURIComponent('/completed-reels'));
  }

  redirect('/my-reels');
}
