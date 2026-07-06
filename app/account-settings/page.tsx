import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/lib/api/auth';
import AccountSettingsClient from './AccountSettingsClient';

export const dynamic = 'force-dynamic';

export default async function AccountSettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  return <AccountSettingsClient initialUser={user} />;
}
