import { getPassProducts, getPassAvailability } from '@/app/lib/passes/server';
import Link from 'next/link';
import PassCatalog from '@/app/components/features/passes/PassCatalog';

export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  const [products, availability] = await Promise.all([
    getPassProducts(),
    getPassAvailability(),
  ]);
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <div className="mb-12 text-center lg:mb-14">
          <p className="mb-3 text-sm font-semibold text-[#FF496D]">
            REELSTAMP PASS
          </p>
          <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
            릴스탬프 이용권
          </h1>
          <Link
            href="/plan"
            className="mt-6 inline-block text-sm font-semibold text-[#D93256] underline underline-offset-4"
          >
            내 이용권 · 결제 내역
          </Link>
        </div>
        <div className="overflow-hidden rounded-[28px]">
          <PassCatalog
            products={products}
            canPurchase={availability.canPurchase}
            allowedProductCodes={availability.allowedProductCodes}
          />
        </div>
      </div>
    </div>
  );
}
