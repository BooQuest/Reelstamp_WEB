
import { getUiText } from '@/app/i18n/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/app/lib/api/auth';
import { buildLoginReturnHref } from '@/app/lib/auth/loginRedirect';
import { getPassProducts, getPassAvailability } from '@/app/lib/passes/server';
import Checkout from './Checkout';
export const dynamic = 'force-dynamic';
export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const t = await getUiText();
  const { code } = await params;
  const user = await getCurrentUser();
  if (!user || user.guest || user.provider === 'GUEST')
    redirect(
      buildLoginReturnHref(`/pricing/checkout/${encodeURIComponent(code)}`),
    );
  const [products, availability] = await Promise.all([
    getPassProducts(),
    getPassAvailability(),
  ]);
  const product = products.find((p) => p.plan === code);
  if (!product) notFound();
  if (
    !availability.canPurchase ||
    !availability.allowedProductCodes.includes(code)
  )
    return (
      <div className="p-12 text-center">
        <h1>{t("현재 이용권 판매가 중지되어 있습니다.")}</h1>
        <Link href="/pricing">{t("이용권 안내로 돌아가기")}</Link>
      </div>
    );
  return <Checkout product={product} userId={user.id} />;
}
