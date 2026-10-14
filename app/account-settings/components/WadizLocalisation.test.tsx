import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import LocaleProvider from '@/app/i18n/LocaleProvider';
import LanguageSelector from '@/app/i18n/LanguageSelector';
import { createUiText } from '@/app/i18n/text';
import PassGrants from '@/app/components/features/passes/PassGrants';
import { couponTotalPeriod, wadizBenefit } from '@/app/lib/coupons/localised-display';
import type { CouponResult, EntitlementGrant, WadizReward } from '@/app/lib/coupons/types';
import CouponResultContent from './CouponResultContent';
import CouponDialog from './CouponDialog';
import AccountPeriod from './AccountPeriod';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const rewards = [
  ['PASS_7D', '1주일 이용권 + 1개월 추가 혜택', '7-day pass + 1 bonus month', 37, 'DAY', '37일', '37 days'],
  ['PASS_1M', '1개월 이용권 + 1개월 추가 혜택', '1-month pass + 1 bonus month', 2, 'MONTH', '2개월', '2 months'],
  ['PASS_3M', '3개월 이용권 + 1개월 추가 혜택', '3-month pass + 1 bonus month', 4, 'MONTH', '4개월', '4 months'],
  ['PASS_1Y', '1년 이용권 + 3개월 추가 혜택', '1-year pass + 3 bonus months', 15, 'MONTH', '1년 3개월', '1 year and 3 months'],
] as const;
function resultFor(row: readonly [WadizReward, string, string, number, 'DAY' | 'MONTH', string, string]): Extract<CouponResult, { couponType: 'WADIZ' }> {
  const [reward, benefit, , durationValue, durationUnit, totalLabel] = row;
  return {
    couponType: 'WADIZ', reward, benefit, productName: benefit, totalLabel, durationValue, durationUnit,
    redemptionId: 'coupon', registeredAt: '2026-10-06T06:00:00Z', startsAt: '2026-11-10T09:00:00Z',
    endsAt: '2028-02-10T09:00:00Z', extended: true,
    entitlements: { serverNow: '2026-10-06T06:00:00Z', active: true, endsAt: '2028-02-10T09:00:00Z', grants: [] },
  };
}
function grantFor(result: CouponResult): EntitlementGrant {
  return { ...result, id: result.redemptionId, source: 'COUPON', revokedAt: null };
}
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it.each(rewards)('shows %s benefits separately from the actual total in both screens and languages', (...row) => {
  const result = resultFor(row);
  const view = render(<LocaleProvider initialLocale="ko" enabled>
    <LanguageSelector />
    <CouponResultContent result={result} onClose={vi.fn()} />
    <PassGrants grants={[grantFor(result)]} now={Date.parse(result.startsAt)} summary={result.entitlements} />
  </LocaleProvider>);
  expect(screen.getAllByText(row[1])).toHaveLength(2);
  expect(screen.getByText(`총 ${row[5]} 이용권이 지급되었습니다.`)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'English' }));
  expect(screen.getAllByText(row[2])).toHaveLength(2);
  expect(screen.getByText(`You’ve received ${row[6]} of access.`)).toBeInTheDocument();
  expect(screen.getByText('Access valid until 2028-02-10 18:00:00 (Korea time)')).toBeInTheDocument();
  expect(screen.getByText('(Valid until: 2028-02-10)')).toBeInTheDocument();
  expect(screen.getByText('Expires at 18:00:00 (Korea time)')).toBeInTheDocument();
  expect(screen.getByText('Access starts: 2026-11-10 18:00:00 (Korea time)')).toBeInTheDocument();
  expect(view.container.querySelector('article')!.textContent).not.toMatch(/[가-힣]/);
  fireEvent.click(screen.getByRole('button', { name: '한국어' }));
  expect(screen.getAllByText(row[1])).toHaveLength(2);
});

it.each(rewards)('keeps %s visible when scheduled, active or expired', (...row) => {
  const result = resultFor(row);
  const grants = [
    { ...grantFor(result), id: 'future', startsAt: '2030-01-01T00:00:00Z', endsAt: '2031-01-01T00:00:00Z' },
    { ...grantFor(result), id: 'active', startsAt: '2020-01-01T00:00:00Z', endsAt: '2030-01-01T00:00:00Z' },
    { ...grantFor(result), id: 'expired', startsAt: '2020-01-01T00:00:00Z', endsAt: '2021-01-01T00:00:00Z' },
  ];
  const { container } = render(<LocaleProvider initialLocale="en" enabled>
    <PassGrants grants={grants} now={Date.parse('2026-10-01T00:00:00Z')} />
  </LocaleProvider>);
  expect(screen.getAllByText(row[2])).toHaveLength(3);
  expect([...container.querySelectorAll('article')].map(a => a.textContent)).toEqual([
    expect.stringContaining('Scheduled'), expect.stringContaining('Active'), expect.stringContaining('Expired'),
  ]);
});

it.each(rewards)('preserves %s bonus wording when an older response omits reward', (...row) => {
  const result = resultFor(row);
  render(<LocaleProvider initialLocale="en" enabled>
    <PassGrants grants={[{ ...grantFor(result), reward: undefined }]} now={Date.parse(result.startsAt)} />
    <CouponResultContent result={{ ...result, reward: undefined as unknown as WadizReward }} onClose={vi.fn()} />
  </LocaleProvider>);
  expect(screen.getAllByText(row[2])).toHaveLength(2);
  expect(screen.queryByText(/^Wadiz coupon pass ·/)).not.toBeInTheDocument();
});

it.each([undefined, null, 'UNKNOWN', 'toString'])('uses an English fallback for missing/unknown reward %s without hiding access', reward => {
  const result = resultFor(rewards[3]);
  render(<LocaleProvider initialLocale="en" enabled>
    <PassGrants grants={[{ ...grantFor(result), reward, productName: '알 수 없는 혜택' }]} now={Date.parse(result.startsAt)} />
    <CouponResultContent result={{ ...result, reward: reward as WadizReward, benefit: '알 수 없는 혜택' }} onClose={vi.fn()} />
  </LocaleProvider>);
  expect(screen.getAllByText('Wadiz coupon pass · 1 year and 3 months')).toHaveLength(2);
});

it('preserves original Korean wording and uses recorded durations rather than inferring them from reward codes', () => {
  const result = { ...resultFor(rewards[2]), benefit: '기존에 저장된 특별 혜택', durationValue: 5 };
  expect(wadizBenefit(result, result.benefit, createUiText('ko'))).toBe(result.benefit);
  expect(couponTotalPeriod(result, createUiText('en'))).toBe('5 months');
});

it('preserves general coupon names and formats singular periods and account expiry', () => {
  const result: CouponResult = { ...resultFor(rewards[0]), couponType: 'GENERAL', reward: null, benefit: null,
    productName: '일반 쿠폰 고유 이름', durationValue: 1, durationUnit: 'YEAR' };
  render(<LocaleProvider initialLocale="en" enabled>
    <CouponResultContent result={result} onClose={vi.fn()} />
    <PassGrants grants={[grantFor(result)]} now={Date.parse(result.startsAt)} />
    <AccountPeriod summary={result.entitlements} onRetry={vi.fn()} />
  </LocaleProvider>);
  expect(screen.getAllByText(result.productName)).toHaveLength(2);
  expect(screen.getByText('You’ve received 1 year of access.')).toBeInTheDocument();
  expect(screen.getByText('Valid until 2028-02-10')).toBeInTheDocument();
});

it('preserves inputs, in-flight registration and its result across repeated language changes', async () => {
  let resolve!: (response: Response) => void;
  const fetcher = vi.fn(() => new Promise<Response>(done => { resolve = done; }));
  vi.stubGlobal('fetch', fetcher);
  const registered = vi.fn();
  render(<LocaleProvider initialLocale="ko" enabled><LanguageSelector />
    <CouponDialog availability={{ wadizEnabled: true, generalEnabled: true, message: null }}
      onAvailabilityChange={vi.fn()} onClose={vi.fn()} onRegistered={registered} />
  </LocaleProvider>);
  const nickname = screen.getByLabelText('닉네임');
  const code = screen.getByLabelText('쿠폰 코드');
  fireEvent.change(nickname, { target: { value: '펀딩 닉네임' } });
  fireEvent.change(code, { target: { value: 'RS-TEST' } });
  fireEvent.click(screen.getByRole('button', { name: 'English' }));
  expect(nickname).toHaveValue('펀딩 닉네임'); expect(code).toHaveValue('RS-TEST');
  fireEvent.submit(code.closest('form')!);
  for (const name of ['한국어', 'English', '한국어', 'English']) fireEvent.click(screen.getByRole('button', { name }));
  fireEvent.submit(code.closest('form')!);
  expect(fetcher).toHaveBeenCalledTimes(1);
  await act(async () => { resolve(new Response(JSON.stringify({ success: true, data: resultFor(rewards[3]) }))); });
  expect(within(screen.getByRole('dialog')).getByText(rewards[3][2])).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '한국어' }));
  expect(within(screen.getByRole('dialog')).getByText(rewards[3][1])).toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledTimes(1); expect(registered).toHaveBeenCalledTimes(1);
});
