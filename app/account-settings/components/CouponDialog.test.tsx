import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CouponDialog from './CouponDialog';
import AccountPeriod from './AccountPeriod';
import type { CouponResult } from '@/app/lib/coupons/types';

const availability = { wadizEnabled: true, generalEnabled: true, message: null };
const availabilityChanged = vi.fn();
const registered = vi.fn();
const close = vi.fn();
const result: CouponResult = {
  redemptionId: 'test', couponType: 'WADIZ', productName: '와디즈 3개월권', reward: 'PASS_3M', benefit: '3개월 이용권 + 1개월 추가 혜택', totalLabel: '4개월',
  durationValue: 4, durationUnit: 'MONTH', registeredAt: '2026-10-06T06:00:00Z',
  startsAt: '2026-11-10T09:00:00Z', endsAt: '2027-03-10T09:00:00Z', extended: true,
  entitlements: { serverNow: '2026-10-06T06:00:00Z', active: true, endsAt: '2027-03-10T09:00:00Z', grants: [] },
};
function fill() {
  fireEvent.change(screen.getByLabelText('닉네임'), { target: { value: '  펀딩 사용자  ' } });
  fireEvent.change(screen.getByLabelText('쿠폰 코드'), { target: { value: '  rs-example  ' } });
}
function response(data: CouponResult = result) { return new Response(JSON.stringify({ success: true, data })); }
beforeEach(() => {
  vi.clearAllMocks();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('coupon registration', () => {
  it('keeps independent drafts, clears errors and switches tabs with the keyboard', () => {
    render(<CouponDialog availability={availability} onAvailabilityChange={availabilityChanged} onClose={close} onRegistered={registered} />);
    const wadiz = screen.getByRole('tab', { name: '와디즈 쿠폰' });
    const general = screen.getByRole('tab', { name: '일반 쿠폰' });
    expect(wadiz).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('닉네임')).toHaveFocus();
    fill();
    fireEvent.keyDown(wadiz, { key: 'ArrowRight' });
    expect(general).toHaveFocus();
    expect(general).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByLabelText('닉네임')).not.toBeInTheDocument();
    expect(screen.queryByText(/2026년 12월 31일/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('쿠폰 코드')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: '쿠폰 등록하기' }));
    expect(screen.getByLabelText('쿠폰 코드')).toHaveFocus();
    expect(screen.getByLabelText('쿠폰 코드')).toHaveAttribute('aria-invalid', 'true');
    fireEvent.change(screen.getByLabelText('쿠폰 코드'), { target: { value: 'RS-GENERAL' } });
    fireEvent.keyDown(general, { key: 'Home' });
    expect(wadiz).toHaveFocus();
    expect(screen.getByLabelText('닉네임')).toHaveValue('  펀딩 사용자  ');
    expect(screen.getByLabelText('쿠폰 코드')).toHaveValue('  rs-example  ');
    expect(screen.getByLabelText('쿠폰 코드')).toHaveAttribute('aria-invalid', 'false');
    fireEvent.keyDown(wadiz, { key: 'End' });
    expect(screen.getByLabelText('쿠폰 코드')).toHaveValue('RS-GENERAL');
  });
  it('restores focus when closed and reopens with an empty Wadiz form', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger); trigger.focus();
    const view = render(<CouponDialog availability={availability} onAvailabilityChange={availabilityChanged} onClose={close} onRegistered={registered} />);
    fill(); fireEvent.click(screen.getByRole('tab', { name: '일반 쿠폰' }));
    view.unmount();
    expect(trigger).toHaveFocus();
    render(<CouponDialog availability={availability} onAvailabilityChange={availabilityChanged} onClose={close} onRegistered={registered} />);
    expect(screen.getByRole('tab', { name: '와디즈 쿠폰' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('닉네임')).toHaveValue('');
    expect(screen.getByLabelText('쿠폰 코드')).toHaveValue('');
    trigger.remove();
  });
  it.each([['DAY', '3일'], ['MONTH', '3개월'], ['YEAR', '3년']] as const)(
    'registers a general %s coupon with code only and no Wadiz bonus', async (durationUnit, totalLabel) => {
      const generalResult: CouponResult = { ...result, couponType: 'GENERAL', productName: '초대 이용권',
        reward: null, benefit: null, durationValue: 3, durationUnit, totalLabel };
      const fetcher = vi.fn().mockResolvedValue(response(generalResult)); vi.stubGlobal('fetch', fetcher);
      render(<CouponDialog availability={availability} onAvailabilityChange={availabilityChanged} onClose={close} onRegistered={registered} />);
      fill(); fireEvent.click(screen.getByRole('tab', { name: '일반 쿠폰' }));
      fireEvent.change(screen.getByLabelText('쿠폰 코드'), { target: { value: ' rs-general ' } });
      fireEvent.click(screen.getByRole('button', { name: '쿠폰 등록하기' }));
      expect(await screen.findByText('초대 이용권')).toBeInTheDocument();
      expect(screen.getByText(`총 ${totalLabel} 이용권이 지급되었습니다.`)).toBeInTheDocument();
      expect(screen.queryByText(/추가 혜택/)).not.toBeInTheDocument();
      expect(fetcher.mock.calls[0][0]).toBe('/api/coupons/redeem');
      expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ code: 'RS-GENERAL' });
      expect(registered).toHaveBeenCalledWith(generalResult);
    },
  );
  it('clears a server failure on tab change without retrying', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, message: '이미 사용된 쿠폰 코드입니다.' }), { status: 409 }));
    vi.stubGlobal('fetch', fetcher);
    render(<CouponDialog availability={availability} onAvailabilityChange={availabilityChanged} onClose={close} onRegistered={registered} />); fill();
    fireEvent.click(screen.getByRole('button', { name: '쿠폰 등록하기' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('tab', { name: '일반 쿠폰' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('전달받은 쿠폰 코드를 입력해 주세요.')).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('validates empty fields without making a request', () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    render(<CouponDialog availability={availability} onAvailabilityChange={availabilityChanged} onClose={close} onRegistered={registered} />);
    fireEvent.click(screen.getByRole('button', { name: '쿠폰 등록하기' }));
    expect(screen.getByLabelText('닉네임')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('쿠폰 코드를 입력해 주세요.')).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('prevents repeated submission, normalizes input and displays the actual schedule', async () => {
    let resolve!: (value: Response) => void;
    const fetcher = vi.fn<typeof fetch>(() => new Promise<Response>((done) => { resolve = done; }));
    vi.stubGlobal('fetch', fetcher);
    render(<CouponDialog availability={availability} onAvailabilityChange={availabilityChanged} onClose={close} onRegistered={registered} />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: '쿠폰 등록하기' }));
    fireEvent.click(screen.getByRole('button', { name: '등록 중...' }));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe('/api/coupons/wadiz/redeem');
    expect(screen.getByRole('tab', { name: '일반 쿠폰' })).toBeDisabled();
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(close).not.toHaveBeenCalled();
    expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string)).toEqual({ nickname: '펀딩 사용자', code: 'RS-EXAMPLE' });
    expect(screen.getByRole('button', { name: '닫기' })).toBeDisabled();
    resolve(response());
    expect(await screen.findByRole('heading', { name: '쿠폰 등록 완료 🎉' })).toBeInTheDocument();
    expect(screen.getByText('총 4개월 이용권이 지급되었습니다.')).toBeInTheDocument();
    expect(screen.getByText(/2027-03-10 까지/)).toBeInTheDocument();
    expect(screen.getByText(/적용 시작: 2026-11-10 18:00:00/)).toBeInTheDocument();
    expect(registered).toHaveBeenCalledWith(result);
    expect(screen.getByRole('heading')).toHaveFocus();
  });
  it.each([
    '닉네임 또는 쿠폰 코드가 올바르지 않습니다.',
    '이미 사용된 쿠폰 코드입니다.',
    '쿠폰 등록 기간이 만료되었습니다.',
  ])('shows %s above submit and keeps the form available for correction', async (message) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, message }), { status: 400 })));
    render(<CouponDialog availability={availability} onAvailabilityChange={availabilityChanged} onClose={close} onRegistered={registered} />); fill();
    fireEvent.click(screen.getByRole('button', { name: '쿠폰 등록하기' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(message);
    expect(alert).toHaveClass('text-red-600');
    expect(alert.nextElementSibling).toBe(screen.getByRole('button', { name: '쿠폰 등록하기' }));
    expect(alert.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'auto' });
    expect(screen.getByRole('heading', { name: '쿠폰 등록' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '확인' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('닉네임')).toHaveValue('  펀딩 사용자  ');
    expect(screen.getByLabelText('쿠폰 코드')).toHaveValue('  rs-example  ');
    screen.getByLabelText('쿠폰 코드').focus();
    fireEvent.change(screen.getByLabelText('쿠폰 코드'), { target: { value: 'RS-CORRECTED' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('쿠폰 코드')).toHaveFocus();
    expect(registered).not.toHaveBeenCalled();
  });
  it('clears failure on nickname edits and retries, including an identical error, then shows success', async () => {
    let resolve!: (value: Response) => void;
    const failureResponse = () => new Response(JSON.stringify({ success: false, message: '이미 사용된 쿠폰 코드입니다.' }), { status: 409 });
    const fetcher = vi.fn()
      .mockImplementationOnce(async () => failureResponse())
      .mockImplementationOnce(async () => failureResponse())
      .mockImplementationOnce(() => new Promise<Response>((done) => { resolve = done; }))
      .mockImplementationOnce(async () => response());
    vi.stubGlobal('fetch', fetcher);
    render(<CouponDialog availability={availability} onAvailabilityChange={availabilityChanged} onClose={close} onRegistered={registered} />); fill();
    const submit = screen.getByRole('button', { name: '쿠폰 등록하기' });
    fireEvent.click(submit);
    await screen.findByRole('alert');
    fireEvent.change(screen.getByLabelText('닉네임'), { target: { value: '수정 닉네임' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(submit);
    await screen.findByRole('alert');
    fireEvent.click(submit);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(submit).toBeDisabled();
    resolve(failureResponse());
    const alert = await screen.findByRole('alert');
    expect(alert.scrollIntoView).toHaveBeenCalledTimes(3);
    fireEvent.click(submit);
    expect(await screen.findByRole('heading', { name: '쿠폰 등록 완료 🎉' })).toHaveFocus();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('쿠폰 코드')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '확인' })).toBeInTheDocument();
    expect(registered).toHaveBeenCalledOnce();
  });
  it.each([
    ['PASS_7D', '1주일 이용권 + 1개월 추가 혜택', '37일'],
    ['PASS_1M', '1개월 이용권 + 1개월 추가 혜택', '2개월'],
    ['PASS_3M', '3개월 이용권 + 1개월 추가 혜택', '4개월'],
    ['PASS_1Y', '1년 이용권 + 3개월 추가 혜택', '1년 3개월'],
  ] as const)('renders the %s reward returned by the server', async (reward, benefit, totalLabel) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ...result, reward, benefit, totalLabel, extended: false })));
    render(<CouponDialog availability={availability} onAvailabilityChange={availabilityChanged} onClose={close} onRegistered={registered} />); fill();
    fireEvent.click(screen.getByRole('button', { name: '쿠폰 등록하기' }));
    expect(await screen.findByText(`총 ${totalLabel} 이용권이 지급되었습니다.`)).toBeInTheDocument();
    expect(screen.getByText(benefit)).toBeInTheDocument();
    expect(screen.queryByText(/적용 시작:/)).not.toBeInTheDocument();
  });
  it('distinguishes network failures and does not claim success', async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError('network')); vi.stubGlobal('fetch', fetcher);
    render(<CouponDialog availability={availability} onAvailabilityChange={availabilityChanged} onClose={close} onRegistered={registered} />); fill();
    fireEvent.click(screen.getByRole('button', { name: '쿠폰 등록하기' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('통신 오류');
    expect(screen.getByLabelText('쿠폰 코드')).toHaveValue('  rs-example  ');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(registered).not.toHaveBeenCalled();
  });
  it('distinguishes an expired login', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    render(<CouponDialog availability={availability} onAvailabilityChange={availabilityChanged} onClose={close} onRegistered={registered} />); fill();
    fireEvent.click(screen.getByRole('button', { name: '쿠폰 등록하기' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('로그인이 만료되었습니다.'));
    expect(screen.getByRole('button', { name: '쿠폰 등록하기' })).toBeEnabled();
  });
});

describe('account period', () => {
  it('distinguishes failed loading, no entitlement, and expiry', () => {
    const retry = vi.fn();
    const view = render(<AccountPeriod summary={null} onRetry={retry} />);
    fireEvent.click(screen.getByRole('button', { name: '다시 확인' })); expect(retry).toHaveBeenCalledOnce();
    expect(screen.queryByText('보유 이용권 없음')).not.toBeInTheDocument();
    view.rerender(<AccountPeriod summary={{ ...result.entitlements, endsAt: null }} onRetry={retry} />);
    expect(screen.getByText('보유 이용권 없음')).toBeInTheDocument();
    view.rerender(<AccountPeriod summary={{ ...result.entitlements, serverNow: result.endsAt, active: false }} onRetry={retry} />);
    expect(screen.getByText('2027-03-10까지 · 기간 만료')).toBeInTheDocument();
    expect(screen.getByText('18:00:00 만료 (한국 시간)')).toBeInTheDocument();
  });
});
