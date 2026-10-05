import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/lib/api/auth';
import { buildLoginReturnHref } from '@/app/lib/auth/loginRedirect';
import { getPaymentHistory } from '@/app/lib/passes/queries';
import PaymentsClient from './PaymentsClient';

export const dynamic = 'force-dynamic';

export default async function PaymentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect(buildLoginReturnHref('/plan/payments'));

  const state = await getPaymentHistory();
  return <PaymentsClient state={state} />;
}
