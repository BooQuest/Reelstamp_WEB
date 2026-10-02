// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
const { user, post, pay, internal } = vi.hoisted(() => ({
  user: vi.fn(),
  post: vi.fn(),
  pay: vi.fn(),
  internal: vi.fn(),
}));
vi.mock('@/app/lib/api/auth', () => ({ getCurrentUser: user }));
vi.mock('@/app/lib/api/server-client', () => ({
  getServerApiClient: async () => ({ post }),
}));
vi.mock('@/app/lib/api/payapp', () => ({ createPayAppPaymentLink: pay }));
vi.mock('@/app/lib/passes/payment-server', async (original) => ({
  ...(await original<typeof import('@/app/lib/passes/payment-server')>()),
  internalPassRequest: internal,
}));
const order = {
  orderId: 'PASS-test',
  productName: 'DB 상품',
  price: 9900,
  status: 'PENDING',
  payUrl: 'https://payapp.kr/pay',
};
function request(origin = 'https://test.local') {
  return new NextRequest('https://test.local/api/passes/orders', {
    method: 'POST',
    headers: { origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: 'PASS_1M',
      version: 'server-version',
      phone: '01012345678',
      idempotencyKey: 'same-request-key',
      price: 1,
      productName: 'forged',
    }),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  user.mockResolvedValue({ id: 1 });
  for (const key of [
    'PAYAPP_USERID',
    'PAYAPP_LINKKEY',
    'PAYAPP_LINKVAL',
    'X_INTERNAL_SECRET',
  ])
    vi.stubEnv(key, 'configured');
  vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'https://test.local');
  post.mockResolvedValue({
    data: { success: true, data: { order, dispatch: true } },
  });
  pay.mockResolvedValue({ state: '1', mul_no: '123', payurl: order.payUrl });
  internal.mockResolvedValue({ data: { data: order } });
});
describe('server-priced checkout', () => {
  it('ignores browser price/name and calls PG with saved order values', async () => {
    expect((await POST(request())).status).toBe(200);
    expect(post).toHaveBeenCalledWith('/api/passes/orders', {
      code: 'PASS_1M',
      version: 'server-version',
      phone: '01012345678',
      idempotencyKey: 'same-request-key',
    });
    expect(pay).toHaveBeenCalledWith(
      expect.objectContaining({
        price: 9900,
        goodname: 'DB 상품',
        var2: 'PASS-test',
      }),
    );
  });
  it('reuses an existing order without calling PayApp again', async () => {
    post.mockResolvedValue({
      data: { success: true, data: { order, dispatch: false } },
    });
    await POST(request());
    expect(pay).not.toHaveBeenCalled();
  });
  it('does not create payment after server rejects purchase', async () => {
    post.mockRejectedValue(new Error('Sales closed'));
    await POST(request());
    expect(pay).not.toHaveBeenCalled();
  });
  it('rejects cross-origin purchase requests', async () => {
    expect((await POST(request('https://other.local'))).status).toBe(403);
    expect(post).not.toHaveBeenCalled();
  });
  it('keeps an ambiguous PG request for review instead of creating a second charge', async () => {
    pay.mockRejectedValue(new Error('timeout'));
    const response = await POST(request());
    expect(await response.json()).toMatchObject({
      orderId: 'PASS-test',
      status: 'REVIEW',
      payUrl: null,
    });
    expect(pay).toHaveBeenCalledTimes(1);
  });
});
