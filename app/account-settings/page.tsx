import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/lib/api/auth';
import { buildLoginReturnHref } from '@/app/lib/auth/loginRedirect';
import { getCouponAvailability, getEntitlements } from '@/app/lib/coupons/server';
import AccountSettingsClient from './AccountSettingsClient';

export const dynamic = 'force-dynamic';

export default async function AccountSettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect(buildLoginReturnHref('/account-settings'));
  }

  const [entitlements, availability] = await Promise.all([
    getEntitlements().catch(() => null),
    getCouponAvailability().catch(() => null),
  ]);
  return <AccountSettingsClient initialUser={user} initialEntitlements={entitlements} initialCouponAvailability={availability} />;
}
