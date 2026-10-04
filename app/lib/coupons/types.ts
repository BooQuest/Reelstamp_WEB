export type CouponType = 'WADIZ' | 'GENERAL';
export interface CouponAvailability {
  wadizEnabled: boolean;
  generalEnabled: boolean;
  message: string | null;
}
export type CouponRequest =
  | { couponType: 'WADIZ'; nickname: string; code: string }
  | { couponType: 'GENERAL'; code: string };

export interface EntitlementGrant {
  id: string;
  source: 'PURCHASE' | 'COUPON' | 'LEGACY';
  couponType?: CouponType | null;
  productName: string;
  durationValue: number;
  durationUnit: 'DAY' | 'MONTH' | 'YEAR';
  startsAt: string;
  endsAt: string;
  revokedAt: string | null;
}

export interface EntitlementSummary {
  serverNow: string;
  active: boolean;
  endsAt: string | null;
  grants: EntitlementGrant[];
}

interface CouponResultBase {
  productName: string;
  redemptionId: string;
  totalLabel: string;
  durationValue: number;
  durationUnit: 'DAY' | 'MONTH' | 'YEAR';
  registeredAt: string;
  startsAt: string;
  endsAt: string;
  extended: boolean;
  entitlements: EntitlementSummary;
}

export type CouponResult = CouponResultBase & (
  | { couponType: 'WADIZ'; reward: 'PASS_7D' | 'PASS_1M' | 'PASS_3M' | 'PASS_1Y'; benefit: string }
  | { couponType: 'GENERAL'; reward: null; benefit: null }
);
