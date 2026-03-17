import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/lib/api/auth';

export const dynamic = 'force-dynamic';

export default async function SavedReelsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login?returnUrl=' + encodeURIComponent('/saved-reels'));
  }

  return (
    <div className="min-h-[calc(100vh-80px)] bg-gradient-to-b from-pink-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-10 sm:py-14">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">저장된 릴스</h1>
        <p className="text-gray-600">저장한 릴스/템플릿 목록 영역 (준비중)</p>
      </div>
    </div>
  );
}
