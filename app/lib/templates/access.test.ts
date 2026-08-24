import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canUseTemplate,
  hasActivePaidSubscription,
  resolveTemplateAccessType,
  shouldWaitForPaidTemplateSubscription,
} from './access';

describe('template access helpers', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_REELSTAMP_BETA_ENABLED', 'false');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('prefers api accessType over tags fallback', () => {
    expect(resolveTemplateAccessType({ accessType: 'PAID', tags: ['후킹'] })).toBe('PAID');
    expect(resolveTemplateAccessType({ accessType: 'FREE', tags: ['패션'] })).toBe('FREE');
  });

  it('falls back to hooking tag with trim handling', () => {
    expect(resolveTemplateAccessType({ tags: ['패션', ' 후킹 '] })).toBe('FREE');
    expect(resolveTemplateAccessType({ tags: ['패션', '변신'] })).toBe('PAID');
  });

  it('requires an active non-free subscription for paid templates', () => {
    const paidTemplate = { accessType: 'PAID' };
    const paidSubscription = {
      subscription: { active: true },
      subscriptionPlan: { plan: 'basic' },
    };

    expect(hasActivePaidSubscription(paidSubscription)).toBe(true);
    expect(
      canUseTemplate({
        template: paidTemplate,
        isAuthenticated: true,
        user: { provider: 'KAKAO', guest: false },
        subscription: paidSubscription,
      })
    ).toBe(true);
    expect(
      canUseTemplate({
        template: paidTemplate,
        isAuthenticated: true,
        user: { provider: 'GUEST', guest: true },
        subscription: paidSubscription,
      })
    ).toBe(false);
  });

  it('blocks paid templates without a subscription outside beta', () => {
    expect(
      canUseTemplate({
        template: { accessType: 'PAID' },
        isAuthenticated: true,
        user: { provider: 'KAKAO', guest: false },
        subscription: null,
      })
    ).toBe(false);
  });

  it('allows paid templates for authenticated guest users during beta', () => {
    vi.stubEnv('NEXT_PUBLIC_REELSTAMP_BETA_ENABLED', 'true');

    expect(
      canUseTemplate({
        template: { accessType: 'PAID' },
        isAuthenticated: true,
        user: { provider: 'GUEST', guest: true },
        subscription: null,
      })
    ).toBe(true);
  });

  it('blocks paid templates for anonymous users during beta', () => {
    vi.stubEnv('NEXT_PUBLIC_REELSTAMP_BETA_ENABLED', 'true');

    expect(
      canUseTemplate({
        template: { accessType: 'PAID' },
        isAuthenticated: false,
        user: null,
        subscription: null,
      })
    ).toBe(false);
  });

  it('does not wait for subscription loading during beta', () => {
    vi.stubEnv('NEXT_PUBLIC_REELSTAMP_BETA_ENABLED', 'true');

    expect(
      shouldWaitForPaidTemplateSubscription({
        template: { accessType: 'PAID' },
        isAuthenticated: true,
        user: { provider: 'KAKAO', guest: false },
        isLoadingSubscription: true,
      })
    ).toBe(false);
  });
});
