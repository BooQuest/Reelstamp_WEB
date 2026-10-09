import type { PassProduct } from '@/app/lib/passes/catalog';
import { formatWon } from '@/app/lib/passes/display';

export default function PassPrice({
  product,
}: {
  product: Pick<PassProduct, 'regularPrice' | 'salePrice'>;
}) {
  const { regularPrice, salePrice } = product;
  const discounted =
    regularPrice !== null &&
    Number.isSafeInteger(regularPrice) &&
    regularPrice > salePrice;

  return (
    <div className="min-w-0 space-y-2">
      {discounted && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="text-gray-500">
            <span className="sr-only">정상가 </span>
            <del>{formatWon(regularPrice)}</del>
          </span>
          <span className="rounded-full bg-rose-50 px-2 py-0.5 font-bold text-[#D93256]">
            {Math.round((1 - salePrice / regularPrice) * 100)}% 할인
          </span>
        </p>
      )}
      <p className="break-words text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
        <span className="sr-only">판매가 </span>
        {formatWon(salePrice)}
      </p>
    </div>
  );
}
