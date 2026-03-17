import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/lib/api/auth';
import PlanClient from './PlanClient';

export const dynamic = 'force-dynamic';

export default async function PlanPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  return <PlanClient />;
}
