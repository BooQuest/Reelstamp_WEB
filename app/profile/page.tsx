import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/lib/api/auth';
import ProfileClient from './ProfileClient';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  return <ProfileClient initialUser={user} />;
}
