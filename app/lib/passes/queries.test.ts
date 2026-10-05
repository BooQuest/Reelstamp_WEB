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
    get.mockResolvedValueOnce({
      data: {
        success: true,
        data: [{ id: 1, status: 'paid', price: 1000, billingKey: 'private' }],
      },
    });
    get.mockResolvedValueOnce({ data: { success: true, data: [{ orderId: 'PASS-test', productName: '구매 당시 이름', price: 4900, status: 'REFUNDED', paidAt: '2026-09-30T00:00:00Z' }] } });
    const result = await getPaymentHistory();
    expect(get).toHaveBeenNthCalledWith(1, '/api/subscription/payments');
    expect(get).toHaveBeenNthCalledWith(2, '/api/passes/orders');
    expect(JSON.stringify(result)).toContain('구매 당시 이름');
    expect(JSON.stringify(result)).toContain('refunded');
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
