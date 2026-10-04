// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as generalPost } from './route';
import { POST } from '../wadiz/redeem/route';
const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('@/app/lib/api/server-client', () => ({ getServerApiClient: async () => ({ post }) }));
function request(body: unknown, origin = 'https://test.local') {
  return new NextRequest('https://test.local/api/coupons/redeem', {
    method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'https://test.local'); });
afterEach(() => vi.unstubAllEnvs());
describe('coupon proxy', () => {
  it('forwards general codes to the general route without client identity or duration', async () => {
    post.mockResolvedValue({ data: { success: true } });
    const response = await generalPost(request({ code: ' rs-general ', userId: 999, durationValue: 99 }));
    expect(response.status).toBe(200);
    expect(post).toHaveBeenCalledWith('/api/coupons/redeem', { code: 'RS-GENERAL' });
  });
  it.each(['harry', '', null])('rejects legacy nickname=%s requests before forwarding', async (nickname) => {
    const response = await generalPost(request({ code: 'RS-SAME', nickname }));
    expect(response.status).toBe(400);
    expect((await response.json()).message).toContain('새로고침');
    expect(post).not.toHaveBeenCalled();
  });
  it('validates the general route and preserves its invalid-code message', async () => {
    expect((await generalPost(request({ code: '' }))).status).toBe(400);
    expect((await generalPost(request({ code: 'RS-ONE' }, 'https://other.test'))).status).toBe(403);
    expect(post).not.toHaveBeenCalled();
    post.mockRejectedValue({ response: { status: 400, data: { errorCode: 'COUPON_CODE_INVALID' } } });
    expect((await (await generalPost(request({ code: 'RS-ONE' }))).json()).message).toBe('쿠폰 코드가 올바르지 않습니다.');
  });
  it('only forwards the nickname and code, never browser-supplied identity or duration', async () => {
    post.mockResolvedValue({ data: { success: true, data: { redemptionId: 'example' } } });
    const response = await POST(request({ nickname: '펀딩', code: 'RS-ONE', userId: 999, durationValue: 999 }));
    expect(post).toHaveBeenCalledWith('/api/coupons/wadiz/redeem', { nickname: '펀딩', code: 'RS-ONE' });
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
  it('rejects cross-origin submissions and malformed inputs without redeeming', async () => {
    expect((await POST(request({ nickname: '펀딩', code: 'RS-ONE' }, 'https://other.test'))).status).toBe(403);
    expect((await POST(request({ nickname: '', code: 'RS-ONE' }))).status).toBe(400);
    expect((await POST(request({ nickname: '펀딩', code: 'x'.repeat(101) }))).status).toBe(400);
    expect(post).not.toHaveBeenCalled();
  });
  it.each([
    [400, 'COUPON_INVALID', '닉네임 또는 쿠폰 코드가 올바르지 않습니다.'],
    [409, 'COUPON_USED', '이미 사용된 쿠폰 코드입니다.'],
    [400, 'COUPON_EXPIRED', '쿠폰 등록 기간이 만료되었습니다.'],
    [401, 'INVALID_TOKEN', '로그인이 만료되었습니다. 다시 로그인해 주세요.'],
    [403, 'FORBIDDEN', '정식 로그인 후 쿠폰을 등록해 주세요.'],
  ])('preserves the %s %s failure', async (status, errorCode, message) => {
    post.mockRejectedValue({ response: { status, data: { errorCode } } });
    const response = await POST(request({ nickname: '펀딩', code: 'RS-ONE' }));
    expect(response.status).toBe(status);
    expect((await response.json()).message).toBe(message);
  });
  it.each([
    ['COUPON_WADIZ_DISABLED', '현재 와디즈 쿠폰은 등록할 수 없습니다.', POST, { nickname: 'harry', code: 'RS-ONE' }],
    ['COUPON_GENERAL_DISABLED', '현재 일반 쿠폰은 등록할 수 없습니다.', generalPost, { code: 'RS-ONE' }],
  ] as const)('preserves %s so the dialog can update availability', async (errorCode, message, redeem, body) => {
    post.mockRejectedValue({ response: { status: 409, data: { errorCode } } });
    const response = await redeem(request(body));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ success: false, errorCode, message });
  });
  it('does not expose backend exception details or retry an uncertain redemption', async () => {
    post.mockRejectedValue({ response: { status: 500, data: { message: 'database details' } } });
    const response = await POST(request({ nickname: '펀딩', code: 'RS-ONE' }));
    expect(response.status).toBe(503);
    expect((await response.json()).message).not.toContain('database');
    expect(post).toHaveBeenCalledTimes(1);
  });
});
