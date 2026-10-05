import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CouponRegistration from './CouponRegistration';
import type { CouponAvailability } from '@/app/lib/coupons/types';

const registered = vi.fn();
const login = vi.fn();
const active: CouponAvailability = { wadizEnabled: true, generalEnabled: true, message: null };
const closed: CouponAvailability = { wadizEnabled: false, generalEnabled: false, message: '쿠폰 등록은 출시 후 이용할 수 있습니다.' };
const statusResponse = (data: CouponAvailability) => new Response(JSON.stringify({ success: true, data }));
beforeEach(() => {
  vi.clearAllMocks();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('keeps the closed notice without a retry action and accepts updated page availability', () => {
  const fetcher = vi.fn().mockImplementation(async () => statusResponse(active)); vi.stubGlobal('fetch', fetcher);
  const view = render(<CouponRegistration initialAvailability={closed} isGuest={false} onLogin={login} onRegistered={registered} />);
  expect(screen.getByRole('button', { name: '쿠폰 등록' })).toBeDisabled();
  expect(screen.getByText(/출시 후/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '쿠폰 등록' }));
  expect(fetcher).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: '다시 확인' })).not.toBeInTheDocument();
  view.rerender(<CouponRegistration initialAvailability={{ ...closed, message: '현재 쿠폰 등록을 이용할 수 없습니다.' }} isGuest={false} onLogin={login} onRegistered={registered} />);
  expect(screen.getByText('현재 쿠폰 등록을 이용할 수 없습니다.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '쿠폰 등록' })).toBeDisabled();
  view.rerender(<CouponRegistration initialAvailability={active} isGuest={false} onLogin={login} onRegistered={registered} />);
  expect(screen.getByRole('button', { name: '쿠폰 등록' })).toBeEnabled();
  expect(fetcher).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it.each([
  [true, false, '와디즈 쿠폰', '일반 쿠폰'],
  [false, true, '일반 쿠폰', '와디즈 쿠폰'],
  [true, true, '와디즈 쿠폰', null],
] as const)('opens only enabled tabs for wadiz=%s general=%s', async (wadizEnabled, generalEnabled, selected, disabled) => {
  const availability = { wadizEnabled, generalEnabled, message: null };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(statusResponse(availability)));
  render(<CouponRegistration initialAvailability={availability} isGuest={false} onLogin={login} onRegistered={registered} />);
  fireEvent.click(screen.getByRole('button', { name: '쿠폰 등록' }));
  const tab = await screen.findByRole('tab', { name: selected });
  expect(tab).toHaveAttribute('aria-selected', 'true');
  if (disabled) {
    expect(screen.getByRole('tab', { name: disabled + ' 등록 불가' })).toBeDisabled();
    expect(screen.queryByText(`현재 ${disabled}은 등록할 수 없습니다.`)).not.toBeInTheDocument();
    fireEvent.keyDown(tab, { key: 'ArrowRight' });
    expect(tab).toHaveFocus();
    expect(tab).toHaveAttribute('aria-selected', 'true');
  }
  if (!wadizEnabled) expect(screen.queryByLabelText('닉네임')).not.toBeInTheDocument();
});

it('keeps availability lookup failure distinct from OFF and never opens on stale status', async () => {
  const fetcher = vi.fn().mockRejectedValue(new Error('offline')); vi.stubGlobal('fetch', fetcher);
  render(<CouponRegistration initialAvailability={active} isGuest={false} onLogin={login} onRegistered={registered} />);
  fireEvent.click(screen.getByRole('button', { name: '쿠폰 등록' }));
  expect(await screen.findByRole('status')).toHaveTextContent('쿠폰 등록 가능 여부를 불러오지 못했습니다.');
  expect(screen.getByRole('button', { name: '쿠폰 등록' })).toBeDisabled();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('keeps the dialog closed when the backend has disabled registration since page load', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(statusResponse(closed)));
  render(<CouponRegistration initialAvailability={active} isGuest={false} onLogin={login} onRegistered={registered} />);
  fireEvent.click(screen.getByRole('button', { name: '쿠폰 등록' }));
  await screen.findByText(/출시 후/);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it.each([true, false])('updates disabled tabs after an OFF response even when status refresh succeeds=%s', async (refreshSucceeds) => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(statusResponse(active))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      success: false, errorCode: 'COUPON_WADIZ_DISABLED', message: '현재 와디즈 쿠폰은 등록할 수 없습니다.',
    }), { status: 409 }));
  if (refreshSucceeds) fetcher.mockResolvedValueOnce(statusResponse({ ...active, wadizEnabled: false }));
  else fetcher.mockRejectedValueOnce(new Error('offline'));
  vi.stubGlobal('fetch', fetcher);
  render(<CouponRegistration initialAvailability={active} isGuest={false} onLogin={login} onRegistered={registered} />);
  fireEvent.click(screen.getByRole('button', { name: '쿠폰 등록' }));
  await screen.findByLabelText('닉네임');
  fireEvent.change(screen.getByLabelText('닉네임'), { target: { value: 'harry' } });
  fireEvent.change(screen.getByLabelText('쿠폰 코드'), { target: { value: 'RS-ONE' } });
  fireEvent.click(screen.getByRole('button', { name: '쿠폰 등록하기' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('현재 와디즈 쿠폰은 등록할 수 없습니다.');
  await waitFor(() => expect(screen.getByRole('tab', { name: '일반 쿠폰' })).toBeEnabled());
  expect(screen.getByRole('tab', { name: '와디즈 쿠폰 등록 불가' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '쿠폰 등록하기' })).toBeDisabled();
  expect(screen.getByLabelText('닉네임')).toHaveValue('harry');
  expect(fetcher.mock.calls.filter(([url]) => url === '/api/coupons/wadiz/redeem')).toHaveLength(1);
  fireEvent.click(screen.getByRole('tab', { name: '일반 쿠폰' }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '쿠폰 등록하기' })).toBeEnabled();
  expect(registered).not.toHaveBeenCalled();
});

it('preserves the guest login flow when registration is available', () => {
  render(<CouponRegistration initialAvailability={active} isGuest onLogin={login} onRegistered={registered} />);
  fireEvent.click(screen.getByRole('button', { name: '쿠폰 등록' }));
  expect(login).toHaveBeenCalledOnce();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
