import { describe, expect, it } from 'vitest';
import { formatPassDate, toPassSummary, toPaymentRecord } from './display';

describe('existing subscription display', () => {
  it('keeps beta access separate from an owned pass', () => {
    const summary = toPassSummary({ subscriptionPlan: { plan: 'FREE' } }, true);
    expect(summary).toMatchObject({
      status: 'none',
      betaEnabled: true,
      startsAt: null,
      endsAt: null,
    });
  });

  it.each(['BASIC', 'PRO', 'MASTER'])('keeps the legacy %s product identity', (plan) => {
    expect(toPassSummary({ subscriptionPlan: { plan } }, false).name.toUpperCase()).toBe(plan);
  });

  it('uses the server access flag even when renewal has been canceled', () => {
    expect(
      toPassSummary({ subscription: { status: 'CANCELED', active: true } }, false).status,
    ).toBe('active');
  });

  it('distinguishes expired access, no subscription, and insufficient information', () => {
    expect(
      toPassSummary({ subscription: { active: false, validUntil: '2026-01-31' } }, false).status,
    ).toBe('expired');
    expect(toPassSummary({ subscription: { status: 'NONE', active: false } }, false).status).toBe(
      'none',
    );
    expect(toPassSummary({}, false)).toMatchObject({
      status: 'unknown',
      name: '상품 정보 확인 필요',
    });
  });

  it('does not invent a product or infer dates from the next billing date', () => {
    const response = { subscription: { active: true, nextBillingDate: '2026-10-31' } };
    expect(toPassSummary(response, false)).toMatchObject({
      name: '상품 정보 확인 필요',
      startsAt: null,
      endsAt: null,
    });
  });

  it('preserves calendar dates and handles missing or invalid dates', () => {
    expect(formatPassDate('2026-09-30T00:30:00+09:00')).toBe('2026년 09월 30일');
    expect(formatPassDate(null)).toBe('날짜 정보 없음');
    expect(formatPassDate('invalid')).toBe('날짜 정보 없음');
  });
});

describe('payment display projection', () => {
  it('keeps the historical amount and cancellation status and drops internal payment fields', () => {
    expect(
      toPaymentRecord({
        id: 1,
        orderId: 'order-1',
        planCode: 'BASIC',
        status: 'canceled',
        price: 1000,
        paidAt: '2026-01-12T17:16:23',
        billingKey: 'private',
        paymentNo: 'internal',
      }),
    ).toEqual({
      id: '1',
      orderId: 'order-1',
      name: 'Basic',
      status: 'canceled',
      amount: 1000,
      paidAt: '2026-01-12T17:16:23',
    });
  });

  it('does not fabricate amounts, products, payment dates or successful states', () => {
    expect(toPaymentRecord({ id: 1, status: 'unrecognized', createdAt: '2026-01-12' })).toEqual({
      id: '1',
      orderId: null,
      name: '상품 정보 확인 필요',
      amount: null,
      paidAt: null,
      status: 'unknown',
    });
    expect(() => toPaymentRecord({})).toThrow();
  });
});
