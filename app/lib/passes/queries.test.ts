import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPaymentHistory } from './queries';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/app/lib/api/server-client', () => ({ getServerApiClient: async () => ({ get }) }));
beforeEach(() => {
  get.mockReset();
});

describe('existing payment history query', () => {
  it('reads through the authenticated server client and only returns display fields', async () => {
    get.mockResolvedValue({
      data: {
        success: true,
        data: [{ id: 1, status: 'paid', price: 1000, billingKey: 'private' }],
      },
    });
    const result = await getPaymentHistory();
    expect(get).toHaveBeenCalledExactlyOnceWith('/api/subscription/payments');
    expect(result.status).toBe('ready');
    expect(JSON.stringify(result)).not.toContain('private');
  });

  it('returns an empty list only after a successful empty response', async () => {
    get.mockResolvedValue({ data: { success: true, data: [] } });
    expect(await getPaymentHistory()).toEqual({ status: 'ready', data: [] });
  });

  it.each([
    { success: false, data: [] },
    { success: true, data: null },
    { success: true, data: [{}] },
  ])('does not turn an unsuccessful or malformed response into an empty history', async (data) => {
    get.mockResolvedValue({ data });
    expect(await getPaymentHistory()).toEqual({ status: 'error' });
  });

  it('distinguishes network errors from empty history', async () => {
    get.mockRejectedValue(new Error('network failure'));
    expect(await getPaymentHistory()).toEqual({ status: 'error' });
  });
});
