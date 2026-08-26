import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/lib/api/auth';
import { buildLoginReturnHref } from '@/app/lib/auth/loginRedirect';
import PlanClient from './PlanClient';

export const dynamic = 'force-dynamic';

export default async function PlanPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect(buildLoginReturnHref('/plan'));
  }

  return <PlanClient />;
}
