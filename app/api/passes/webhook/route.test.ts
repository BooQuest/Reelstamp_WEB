// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
const { internal } = vi.hoisted(() => ({ internal: vi.fn() }));
vi.mock('@/app/lib/passes/payment-server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/lib/passes/payment-server')>()),
  internalPassRequest: internal,
}));
function request(overrides = {}) {
  return new NextRequest('https://test.local/api/passes/webhook', {
    method: 'POST',
    body: new URLSearchParams({
      userid: 'merchant',
      linkkey: 'key',
      linkval: 'value',
      var2: 'PASS-test',
      mul_no: '123',
      price: '4900',
      pay_state: '4',
      ...overrides,
    }),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('PAYAPP_USERID', 'merchant');
  vi.stubEnv('PAYAPP_LINKKEY', 'key');
  vi.stubEnv('PAYAPP_LINKVAL', 'value');
});
describe('PayApp notification', () => {
  it('rejects forged credentials before database processing', async () => {
    expect((await POST(request({ linkval: 'forged' }))).status).toBe(403);
    expect(internal).not.toHaveBeenCalled();
  });
  it('returns SUCCESS only after processing completes', async () => {
    internal.mockResolvedValue({ data: 'SUCCESS' });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('SUCCESS');
    expect(internal).toHaveBeenCalledWith(
      'events',
      expect.objectContaining({
        orderId: 'PASS-test',
        paymentNo: '123',
        amount: 4900,
        payState: 4,
      }),
    );
  });
  it('matches partial refunds to the original transaction and preserves the refund amount', async () => {
    internal.mockResolvedValue({ data: 'SUCCESS' });
    const result = await POST(
      request({
        pay_state: '70',
        mul_no: '456',
        price: '1000',
        orig_mul_no: '123',
        orig_price: '4900',
      }),
    );
    expect(result.status).toBe(200);
    expect(internal).toHaveBeenCalledWith(
      'events',
      expect.objectContaining({
        paymentNo: '123',
        sourcePaymentNo: '456',
        amount: 4900,
        cancelAmount: '1000',
      }),
    );
  });
  it('asks PayApp to retry when persistence fails', async () => {
    internal.mockRejectedValue(new Error('database failure'));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toBe('SUCCESS');
  });
});
