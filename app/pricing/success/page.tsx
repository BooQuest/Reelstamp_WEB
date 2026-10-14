
import { getUiText } from '@/app/i18n/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/lib/api/auth';
import { buildLoginReturnHref } from '@/app/lib/auth/loginRedirect';
import PaymentResult from './PaymentResult';
export const dynamic = 'force-dynamic';
export default async function PaymentResultPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const t = await getUiText();
  const { orderId } = await searchParams;
  if (!orderId)
    return (
      <main className="p-12 text-center">
        <h1 className="text-xl font-bold">{t("결제 상태를 확인할 수 없습니다.")}</h1>
        <Link
          className="mt-6 inline-block text-[#D93256]"
          href="/plan/payments"
        >
          {t("결제 내역 확인하기")}</Link>
      </main>
    );
  if (!(await getCurrentUser()))
    redirect(
      buildLoginReturnHref(
        `/pricing/success?orderId=${encodeURIComponent(orderId)}`,
      ),
    );
  return <PaymentResult orderId={orderId} />;
}
