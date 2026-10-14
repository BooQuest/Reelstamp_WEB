// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/app/lib/api/server-client', () => ({ getMutableServerApiClient: async () => ({ get }) }));
beforeEach(() => get.mockReset());

it('forwards the read locale and only exposes display fields', async () => {
  get.mockResolvedValue({ data: { data: { orderId: 'PASS-test', productName: '구매 원문',
    displayProductName: '1-month pass', displayLocale: 'en', price: 9900, status: 'PAID',
    userId: 99, paymentNo: 'internal-only', payUrl: 'private-link' } } });
  const response = await GET(new NextRequest('https://test.local/api/passes/orders/PASS-test?locale=en'),
    { params: Promise.resolve({ id: 'PASS-test' }) });
  expect(get).toHaveBeenCalledWith('/api/passes/orders/PASS-test?locale=en');
  expect(await response.json()).toEqual({ orderId: 'PASS-test', productName: '구매 원문',
    displayProductName: '1-month pass', displayLocale: 'en', price: 9900, status: 'PAID' });
  expect(response.headers.get('Cache-Control')).toBe('no-store');
});

it('rejects unsupported explicit read locales before calling the backend', async () => {
  const response = await GET(new NextRequest('https://test.local/api/passes/orders/PASS-test?locale=ja'),
    { params: Promise.resolve({ id: 'PASS-test' }) });
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ errorCode: 'UNSUPPORTED_LOCALE' });
  expect(get).not.toHaveBeenCalled();
});
