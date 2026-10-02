import type { PassGrant } from '@/app/lib/passes/catalog';
import Link from 'next/link';
function date(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: false,
  }).format(new Date(value));
}
export default function PassGrants({
  grants,
  now,
}: {
  grants: PassGrant[] | null;
  now: number;
}) {
  if (!grants)
    return (
      <aside role="alert" className="mb-6 rounded-2xl border p-5">
        기간제 이용권 정보를 불러오지 못했습니다.{' '}
        <Link href="/plan" className="text-[#D93256]">
          다시 확인
        </Link>
      </aside>
    );
  if (!grants.length) return null;
  return (
    <section className="mb-6 space-y-4" aria-label="기간제 이용권">
      {grants.map((grant) => (
        <article
          key={grant.orderId}
          className="rounded-2xl border border-rose-100 bg-white p-6"
        >
          <h2 className="text-lg font-bold">{grant.productName}</h2>
          <p className="mt-2 text-sm text-[#D93256]">
            {grant.revokedAt
              ? '환불로 회수됨'
              : Date.parse(grant.endsAt) <= now
                ? '기간 만료'
                : Date.parse(grant.startsAt) > now
                  ? '사용 예정'
                  : '사용 중'}
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <div>
              <dt>이용 시작</dt>
              <dd>{date(grant.startsAt)} (한국 시간)</dd>
            </div>
            <div>
              <dt>이용 종료</dt>
              <dd>{date(grant.endsAt)} (한국 시간)</dd>
            </div>
          </dl>
        </article>
      ))}
    </section>
  );
}
