'use client';
export default function PricingError({ reset }: { reset: () => void }) {
  return (
    <main className="p-12 text-center">
      <h1 className="text-xl font-bold">이용권 정보를 불러오지 못했습니다.</h1>
      <button
        onClick={reset}
        className="mt-6 rounded-xl bg-[#FF496D] px-6 py-3 text-white"
      >
        다시 시도
      </button>
    </main>
  );
}
