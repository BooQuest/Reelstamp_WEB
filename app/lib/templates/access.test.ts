import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canUseTemplate,
  shouldWaitForPaidTemplateSubscription,
  type TemplateAccessSubscription,
} from './access';

const state = vi.hoisted(() => ({ beta: false }));
vi.mock('@/app/lib/constants/beta', () => ({ isReelstampBetaEnabled: () => state.beta }));

const paid = { accessType: 'PAID' };
const user = { role: 'USER', provider: 'GOOGLE', guest: false };
const subscriptions: { name: string; value: TemplateAccessSubscription; allowed: boolean }[] = [
  { name: 'unavailable subscription data', value: null, allowed: false },
  { name: 'no active pass', value: { passActive: false }, allowed: false },
  { name: 'active purchased or coupon pass', value: { passActive: true }, allowed: true },
  { name: 'expired legacy subscription', value: { subscription: { active: false }, subscriptionPlan: { plan: 'PRO' } }, allowed: false },
  { name: 'active legacy subscription', value: { subscription: { active: true }, subscriptionPlan: { plan: 'PRO' } }, allowed: true },
  { name: 'free subscription', value: { subscription: { active: true }, subscriptionPlan: { plan: 'FREE' } }, allowed: false },
];

beforeEach(() => { state.beta = false; });

describe.each(['ADMIN', 'admin'])('%s template access', (role) => {
  it.each(subscriptions)('allows free and paid templates with $name', ({ value }) => {
    for (const accessType of ['FREE', 'PAID']) {
      expect(canUseTemplate({ template: { accessType }, isAuthenticated: true, user: { ...user, role }, subscription: value })).toBe(true);
    }
  });

  it('does not wait for subscription lookup', () => {
    expect(shouldWaitForPaidTemplateSubscription({ template: paid, isAuthenticated: true, user: { ...user, role }, isLoadingSubscription: true })).toBe(false);
  });

  it('requires authentication for paid templates', () => {
    expect(canUseTemplate({ template: paid, isAuthenticated: false, user: { ...user, role }, subscription: null })).toBe(false);
  });

  it.each([false, true])('still blocks coming-soon templates with beta=%s', (beta) => {
    state.beta = beta;
    expect(canUseTemplate({ template: { ...paid, status: 'COMING_SOON' }, isAuthenticated: true, user: { ...user, role }, subscription: null })).toBe(false);
  });
});

describe('existing access policy', () => {
  it.each(subscriptions)('preserves USER access with $name', ({ value, allowed }) => {
    expect(canUseTemplate({ template: paid, isAuthenticated: true, user, subscription: value })).toBe(allowed);
  });

  it('waits for a regular user subscription lookup', () => {
    expect(shouldWaitForPaidTemplateSubscription({ template: paid, isAuthenticated: true, user, isLoadingSubscription: true })).toBe(true);
  });

  it('allows free access without a subscription', () => {
    expect(canUseTemplate({ template: { accessType: 'FREE' }, isAuthenticated: false, user: null, subscription: null })).toBe(true);
  });

  it.each([undefined, null, 'USER', 'UNKNOWN'])('does not grant an admin bypass for role=%s', (role) => {
    expect(canUseTemplate({ template: paid, isAuthenticated: true, user: { ...user, role }, subscription: null })).toBe(false);
  });

  it('rejects guests even with an active pass outside beta', () => {
    expect(canUseTemplate({ template: paid, isAuthenticated: true, user: { ...user, guest: true, provider: 'GUEST' }, subscription: { passActive: true } })).toBe(false);
  });

  it('preserves beta access for authenticated users and guests', () => {
    state.beta = true;
    for (const guest of [false, true]) {
      expect(canUseTemplate({ template: paid, isAuthenticated: true, user: { ...user, guest }, subscription: null })).toBe(true);
    }
    expect(canUseTemplate({ template: paid, isAuthenticated: false, user: null, subscription: null })).toBe(false);
  });
});
