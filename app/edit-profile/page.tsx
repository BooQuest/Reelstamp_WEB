import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/lib/api/auth';
import EditProfileClient from './EditProfileClient';

export const dynamic = 'force-dynamic';

export default async function EditProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  return <EditProfileClient />;
}
