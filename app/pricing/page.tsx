import { getPassProducts, getPassAvailability } from '@/app/lib/passes/server';
import Link from 'next/link';
import PassCatalog from '@/app/components/features/passes/PassCatalog';
import { isReelstampBetaEnabled } from '@/app/lib/constants/beta';
// 결제 테스트 중에는 커버를 숨깁니다. 복원 시 import와 아래 보존 코드를 함께 활성화합니다.
// import { PRICING_BETA_NOTICE } from '@/app/lib/constants/plans';

export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  const [products, availability] = await Promise.all([
    getPassProducts(),
    getPassAvailability(),
  ]);
  // const covered = availability.covered && !availability.canPurchase;
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
        {isReelstampBetaEnabled() && (
          <p className="mb-7 text-center text-sm leading-6 text-gray-500">
            현재는 베타 무료 이용 기간입니다. 이용권 판매 시작 전까지 베타
            서비스를 계속 이용하실 수 있습니다.
          </p>
        )}
        <div className="relative overflow-hidden rounded-[28px]">
          {/* 기존 카드 영역 커버 설정 보존 (복원 시 새 카드의 grid 배치는 유지):
            className="pointer-events-none flex select-none flex-col items-stretch justify-center gap-6 opacity-35 blur-[5px] grayscale lg:flex-row lg:gap-8"
            기존 PricingPlanCard 개별 흐림 설정: blurDetails={true}
          */}
          {/* 결제 테스트를 위해 블러·투명도·상호작용 차단 설정을 주석으로 보존합니다.
          <div
            className={
              covered
                ? 'pointer-events-none select-none opacity-35 blur-[5px] grayscale'
                : ''
            }
          >
          */}
          <div>
            <PassCatalog
              products={products}
              canPurchase={availability.canPurchase}
              allowedProductCodes={availability.allowedProductCodes}
            />
          </div>
          {/* 결제 테스트 후 복원할 커버·베타 무료 이용 안내:
          {covered && (
            <>
              <div className="pointer-events-none absolute inset-0 z-[5] bg-gray-200/70" />
              <div className="absolute inset-0 z-10 flex items-start justify-center px-4 pt-10 sm:pt-14 lg:items-center lg:pt-0">
                <div className="w-full max-w-[560px] rounded-3xl border border-[#FFD4DD] bg-white/95 px-6 py-7 text-center shadow-2xl shadow-[#FF496D]/10 backdrop-blur sm:px-8 sm:py-8">
                  <p className="text-2xl font-extrabold leading-tight text-[#373A46] sm:text-3xl">
                    {PRICING_BETA_NOTICE.title}
                  </p>
                  <p className="mt-4 text-base font-semibold leading-7 text-gray-700 sm:text-lg">
                    {PRICING_BETA_NOTICE.description}
                  </p>
                  <p className="mt-3 text-sm font-medium leading-6 text-[#FF496D] sm:text-base">
                    {PRICING_BETA_NOTICE.supportingText}
                  </p>
                </div>
              </div>
            </>
          )}
          */}
          {/* 출시 전 재적용할 회색 커버 및 원본 출시 안내 JSX 보존:
          <div className="pointer-events-none absolute inset-0 z-[5] bg-gray-200/70" />

          <div className="absolute inset-0 z-10 flex items-start justify-center px-4 pt-10 sm:pt-14 lg:items-center lg:pt-0">
            <div className="w-full max-w-[560px] rounded-3xl border border-[#FFD4DD] bg-white/95 px-6 py-7 text-center shadow-2xl shadow-[#FF496D]/10 backdrop-blur sm:px-8 sm:py-8">
              <p className="text-2xl font-extrabold leading-tight text-[#373A46] sm:text-3xl">
                {PRICING_BETA_NOTICE.title}
              </p>
              <p className="mt-4 text-base font-semibold leading-7 text-gray-700 sm:text-lg">
                {PRICING_BETA_NOTICE.description}
              </p>
              <p className="mt-3 text-sm font-medium leading-6 text-[#FF496D] sm:text-base">
                {PRICING_BETA_NOTICE.supportingText}
              </p>
            </div>
          </div>
          */}
        </div>
      </div>
    </div>
  );
}
