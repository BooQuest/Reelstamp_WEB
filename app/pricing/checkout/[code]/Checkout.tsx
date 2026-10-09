'use client';

import { authFetch } from '@/app/lib/auth/browser-session';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { durationLabel, type PassProduct } from '@/app/lib/passes/catalog';
import PassPrice from '@/app/components/features/passes/PassPrice';
import { buildLoginReturnHref } from '@/app/lib/auth/loginRedirect';
export default function Checkout({
  product,
  userId,
}: {
  product: PassProduct;
  userId: number;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);
  const key = useRef<string | null>(null);
  const lockedPhone = useRef<string | null>(null);
  async function purchase(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const storageKey = `pass-checkout-${userId}-${product.plan}-${product.version}`;
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const previous = JSON.parse(saved);
        key.current = previous.key;
        lockedPhone.current = previous.phone;
      }
      key.current ??= crypto.randomUUID();
      lockedPhone.current ??= phone.replace(/\D/g, '');
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ key: key.current, phone: lockedPhone.current }),
      );
      const response = await authFetch('/api/passes/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: product.plan,
          version: product.version,
          phone: lockedPhone.current,
          idempotencyKey: key.current,
        }),
      });
      const data = await response.json();
      if (response.status === 401) {
        router.push(buildLoginReturnHref(`/pricing/checkout/${product.plan}`));
        return;
      }
      if (!response.ok) {
        if (response.status === 409) setStale(true);
        throw new Error(data.message || '결제 요청을 확인할 수 없습니다.');
      }
      // 주문 확인 이후에만 새 구매를 허용합니다. 네트워크 오류 때에는 키를 유지합니다.
      sessionStorage.removeItem(storageKey);
      if (data.payUrl) window.location.assign(data.payUrl);
      else
        router.push(
          `/pricing/success?orderId=${encodeURIComponent(data.orderId)}`,
        );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : '결제 요청을 확인할 수 없습니다.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <h1 className="mb-6 text-2xl font-bold">구매 확인</h1>
      <form
        onSubmit={purchase}
        className="space-y-6 rounded-3xl border border-gray-200 bg-white p-7"
      >
        <h2 className="text-xl font-bold">{product.name}</h2>
        <p>이용기간 {durationLabel(product)}</p>
        <PassPrice product={product} />
        <p className="text-sm text-gray-600">1회 결제 · 자동갱신 없음</p>
        <label className="block text-sm">
          휴대전화번호
          <input
            type="tel"
            autoComplete="tel"
            required
            pattern="01[016789][0-9]{7,8}"
            placeholder="01012345678"
            value={phone}
            disabled={busy || !!lockedPhone.current}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
            className="mt-2 w-full rounded-xl border p-3"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        {stale ? (
          <Link href="/pricing" className="block text-[#D93256]">
            변경된 이용권 확인하기
          </Link>
        ) : (
          <button
            disabled={busy}
            className="w-full rounded-xl bg-[#FF496D] p-3 font-semibold text-white disabled:opacity-50"
          >
            {busy ? '결제 요청 확인 중…' : `${product.name} 구매하기`}
          </button>
        )}
        <Link
          href="/plan/payments"
          className="block text-center text-sm text-gray-600"
        >
          결제 내역 확인
        </Link>
      </form>
    </main>
  );
}
