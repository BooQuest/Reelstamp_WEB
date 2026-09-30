import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/lib/api/auth';
import { buildLoginReturnHref } from '@/app/lib/auth/loginRedirect';
import PlanClient from './PlanClient';
import { getSubscriptionStatusAction } from '@/app/actions/auth';
import { isReelstampBetaEnabled } from '@/app/lib/constants/beta';
import { toPassSummary, type PassSummary, type QueryState } from '@/app/lib/passes/display';

export const dynamic = 'force-dynamic';

export default async function PlanPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect(buildLoginReturnHref('/plan'));
  }

  const result = await getSubscriptionStatusAction();
  const state: QueryState<PassSummary> =
    result.success && result.data
      ? { status: 'ready', data: toPassSummary(result.data, isReelstampBetaEnabled()) }
      : { status: 'error' };

  return <PlanClient state={state} />;
}
