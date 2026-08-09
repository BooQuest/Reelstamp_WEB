import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/lib/api/auth';
import { buildLoginReturnHref } from '@/app/lib/auth/loginRedirect';
import AccountSettingsClient from './AccountSettingsClient';

export const dynamic = 'force-dynamic';

export default async function AccountSettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect(buildLoginReturnHref('/account-settings'));
  }

  return <AccountSettingsClient initialUser={user} />;
}
