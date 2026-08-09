import { describe, expect, it } from 'vitest';
import {
  canUseTemplate,
  hasActivePaidSubscription,
  resolveTemplateAccessType,
} from './access';

describe('template access helpers', () => {
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
});
