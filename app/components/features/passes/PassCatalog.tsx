import Link from 'next/link';
import { durationLabel, type PassProduct } from '@/app/lib/passes/catalog';
import { Check } from 'lucide-react';
import { PASS_DISPLAY_FEATURES } from '@/app/lib/constants/pass-display';
import PassPrice from './PassPrice';

export default function PassCatalog({
  products,
  canPurchase,
  allowedProductCodes,
}: {
  products: PassProduct[];
  canPurchase: boolean;
  allowedProductCodes: string[];
}) {
  return (
    <section
      aria-label="이용권 목록"
      className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:gap-8 xl:grid-cols-4"
    >
      {products.map((product) => (
        <article
          key={product.plan}
          className="flex flex-col rounded-[20px] border border-transparent p-[25px] sm:min-h-[420px]"
          style={{
            background:
              'linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.3) 100%), #F7F7FA',
          }}
        >
          <h2 className="mb-4 text-2xl font-bold text-gray-900">
            {product.name}
          </h2>
          <PassPrice product={product} />
          <p className="mb-6 mt-2 text-sm text-gray-600">
            이용기간 {durationLabel(product)}
          </p>
          <ul className="mb-8 space-y-2">
            {PASS_DISPLAY_FEATURES.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-2 text-base leading-relaxed text-gray-700"
              >
                <Check
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0 text-[#FF496D]"
                />
                {feature}
              </li>
            ))}
          </ul>
          <p className="mb-3 mt-auto text-sm text-gray-600">
            1회 결제 · 자동갱신 없음
          </p>
          {canPurchase && allowedProductCodes.includes(product.plan) ? (
            <Link
              href={`/pricing/checkout/${product.plan}`}
              className="min-h-12 w-full rounded-xl bg-[#FF496D] px-4 py-3 text-center text-sm font-bold text-white"
            >
              {product.name} 구매하기
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="min-h-12 w-full cursor-not-allowed rounded-xl bg-gray-300 px-4 py-3 text-sm font-bold text-gray-600"
            >
              출시 예정
            </button>
          )}
        </article>
      ))}
    </section>
  );
}
