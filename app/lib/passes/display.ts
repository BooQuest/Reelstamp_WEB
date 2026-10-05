export type QueryState<T> =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: T };

export interface PassSummary {
  status: 'none' | 'active' | 'expired' | 'unknown';
  name: string;
  startsAt: string | null;
  endsAt: string | null;
  betaEnabled: boolean;
}

export interface PaymentRecord {
  id: string;
  orderId: string | null;
  name: string;
  amount: number | null;
  paidAt: string | null;
  status: 'pending' | 'paid' | 'failed' | 'canceled' | 'refunded' | 'partial_refund' | 'waiting_deposit' | 'unknown';
}

const LEGACY_NAMES: Record<string, string> = {
  FREE: '무료 이용',
  BASIC: 'Basic',
  PRO: 'Pro',
  MASTER: 'Master',
};

function productName(code?: string | null, name?: string | null) {
  return name?.trim() || LEGACY_NAMES[code?.toUpperCase() ?? ''] || '상품 정보 확인 필요';
}

// 런타임 API에는 null이 포함될 수 있습니다. 기존 공개 응답 타입은 변경하지 않습니다.
interface SubscriptionDisplaySource {
  subscription?: {
    status?: string;
    active?: boolean;
    currentPeriodStart?: string | null;
    validUntil?: string | null;
  } | null;
  subscriptionPlan?: { plan?: string | null; name?: string | null } | null;
}

export function toPassSummary(
  source: SubscriptionDisplaySource,
  betaEnabled: boolean,
): PassSummary {
  const subscription = source.subscription;
  const plan = source.subscriptionPlan;
  const noPass =
    plan?.plan?.toUpperCase() === 'FREE' || subscription?.status?.toUpperCase() === 'NONE';
  const status = noPass
    ? 'none'
    : subscription?.active === true
      ? 'active'
      : subscription?.active === false && !!subscription.validUntil
        ? 'expired'
        : 'unknown';

  return {
    status,
    name: noPass ? '보유 이용권 없음' : productName(plan?.plan, plan?.name),
    // 다음 결제일을 만료일로 바꾸거나 없는 날짜를 계산하지 않습니다.
    startsAt: noPass ? null : (subscription?.currentPeriodStart ?? null),
    endsAt: noPass ? null : (subscription?.validUntil ?? null),
    betaEnabled,
  };
}

export function toPaymentRecord(value: unknown): PaymentRecord {
  if (!value || typeof value !== 'object') throw new Error('Invalid payment history');
  const row = value as Record<string, unknown>;
  if (
    (typeof row.id !== 'number' && typeof row.id !== 'string') ||
    typeof row.status !== 'string'
  ) {
    throw new Error('Invalid payment history');
  }
  const text = (key: string) => (typeof row[key] === 'string' ? (row[key] as string) : null);
  const rawStatus = row.status.toLowerCase();
  const status = rawStatus === 'cancelled' ? 'canceled' : rawStatus;

  // 원본 응답을 펼치지 않습니다. 빌링키/거래 내부 정보는 브라우저에 전달하지 않습니다.
  return {
    id: String(row.id),
    orderId: text('orderId'),
    name: productName(text('planCode')),
    amount: typeof row.price === 'number' && Number.isFinite(row.price) ? row.price : null,
    paidAt: text('paidAt'),
    status: ['pending', 'paid', 'failed', 'canceled'].includes(status)
      ? (status as PaymentRecord['status'])
      : 'unknown',
  };
}

export function formatWon(amount: number | null) {
  return amount === null ? '금액 정보 없음' : `${amount.toLocaleString('ko-KR')}원`;
}

export function formatPassDate(value: string | null) {
  if (!value) return '날짜 정보 없음';
  // 날짜 부분을 그대로 표시해 브라우저 시간대에 따른 하루 이동을 방지합니다.
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value);
  if (!match || Number.isNaN(Date.parse(value))) return '날짜 정보 없음';
  return `${match[1]}년 ${match[2]}월 ${match[3]}일`;
}
