import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/lib/api/auth';
import { buildLoginReturnHref } from '@/app/lib/auth/loginRedirect';
import EditProfileClient from './EditProfileClient';

export const dynamic = 'force-dynamic';

export default async function EditProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect(buildLoginReturnHref('/edit-profile'));
  }

  return <EditProfileClient />;
}
