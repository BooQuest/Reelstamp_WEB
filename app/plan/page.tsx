import PassGrants from '@/app/components/features/passes/PassGrants';
import { getPassGrants } from '@/app/lib/passes/server';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/lib/api/auth';
import { buildLoginReturnHref } from '@/app/lib/auth/loginRedirect';
import PlanClient from './PlanClient';
import { getSubscriptionStatusAction } from '@/app/actions/auth';
import {
  toPassSummary,
  type PassSummary,
  type QueryState,
} from '@/app/lib/passes/display';

export const dynamic = 'force-dynamic';

export default async function PlanPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect(buildLoginReturnHref('/plan'));
  }

  const result = await getSubscriptionStatusAction();
  const state: QueryState<PassSummary> =
    result.success && result.data
      ? {
          status: 'ready',
          data: toPassSummary(result.data),
        }
      : { status: 'error' };

  let passData;
  try {
    passData = await getPassGrants();
  } catch {
    passData = null;
  }
  return (
    <PlanClient state={state} hasPasses={!!passData?.grants.length}>
      <PassGrants summary={passData?.summary} grants={passData?.grants ?? null} now={passData?.now ?? 0} />
    </PlanClient>
  );
}
