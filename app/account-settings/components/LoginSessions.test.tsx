import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import LoginSessions from './LoginSessions';
const record = { sessionId:'one',userAgent:'Mozilla/5.0 (Windows) Chrome/100',authenticatedAt:'2026-10-01T00:00:00Z',lastSeenAt:'2026-10-02T00:00:00Z',expiresAt:'2026-10-15T00:00:00Z',current:false };
const list = () => new Response(JSON.stringify({success:true,data:[record]}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});
it('shows browser details and does not revoke without confirmation',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(list()));vi.spyOn(window,'confirm').mockReturnValue(false);
  render(<LoginSessions />);await screen.findByText('Chrome · Windows');
  fireEvent.click(screen.getByRole('button',{name:'로그아웃'}));
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('keeps the session in the list and reports failed logout',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(list()).mockResolvedValueOnce(new Response(null,{status:503})));
  vi.spyOn(window,'confirm').mockReturnValue(true);render(<LoginSessions />);await screen.findByText('Chrome · Windows');
  fireEvent.click(screen.getByRole('button',{name:'로그아웃'}));
  await screen.findByRole('alert');expect(screen.getByText('Chrome · Windows')).toBeTruthy();
  await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(2));
});
