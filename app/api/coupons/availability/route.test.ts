// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
import { GET } from './route';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/app/lib/api/server-client', () => ({ getMutableServerApiClient: async () => ({ get }) }));
beforeEach(() => vi.clearAllMocks());

it('returns the backend flags with no cache', async () => {
  const availability = { wadizEnabled: false, generalEnabled: true, message: null };
  get.mockResolvedValue({ data: { success: true, data: availability } });
  const response = await GET();
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect((await response.json()).data).toEqual(availability);
  expect(get).toHaveBeenCalledWith('/api/coupons/availability', expect.any(Object));
});

it.each(['failed', 'malformed'])('does not treat %s lookup as an open or closed status', async (reason) => {
  if (reason === 'failed') get.mockRejectedValue(new Error('internal connection details'));
  else get.mockResolvedValue({ data: { success: true, data: { wadizEnabled: 'true' } } });
  const response = await GET();
  expect(response.status).toBe(503);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  const body = await response.json();
  expect(body.message).toContain('쿠폰 등록 가능 여부를 불러오지 못했습니다.');
  expect(body.data).toBeUndefined();
});
