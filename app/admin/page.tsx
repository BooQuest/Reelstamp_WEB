'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/app/components/providers/AuthProvider';
import { USER_ROLES } from '@/app/lib/constants/auth';
import TemplateRequestStatsPanel from '@/app/components/features/admin/TemplateRequestStatsPanel';

export default function AdminPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const isAdmin = isAuthenticated && user?.role?.toUpperCase() === USER_ROLES.ADMIN;

  useEffect(() => {
    if (!isAdmin) router.replace('/');
  }, [isAdmin, router]);

  if (!isAdmin) {
    return (
      <div className="admin-page-guard flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="admin-page-container bg-gradient-to-b from-white to-pink-50/30 min-h-screen">
      <div className="w-full pt-8 sm:pt-12 pb-4">
        <section className="admin-page-section mb-16">
          <div className="admin-page-header px-4 sm:px-6 lg:px-8 mb-8">
            <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">관리자 센터</h1>
          </div>
          <div className="admin-page-tab-wrapper px-4 sm:px-6 lg:px-8 mb-8">
            <div className="flex border-b-2 border-pink-100 bg-white/40 rounded-t-3xl p-1.5 pb-0">
              <h2 className="admin-page-tab px-10 py-4 text-base font-black rounded-t-2xl text-[#FF496D] bg-white">
                템플릿 요청
              </h2>
            </div>
          </div>
          <div className="admin-page-content px-4 sm:px-6 lg:px-8">
            <TemplateRequestStatsPanel />
          </div>
        </section>
      </div>
    </div>
  );
}
