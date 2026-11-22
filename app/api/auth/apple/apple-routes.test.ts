// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks=vi.hoisted(()=>({ get:vi.fn(),set:vi.fn(),delete:vi.fn(),guest:vi.fn() }));
vi.mock('next/headers',()=>({ cookies:async()=>mocks }));
vi.mock('@/app/lib/auth/guest-credential',()=>({getGuestCredential:mocks.guest}));
vi.mock('@/app/lib/constants/api',()=>({API_CONFIG:{WEB_BASE_URL:'https://api-dev.reelstamp.co.kr'}}));
import { POST } from './start/route';
import { GET } from './complete/route';
import { APPLE_COOKIE } from '@/app/lib/auth/apple';
const web='https://reelstamp-web.vercel.app',id='12345678-1234-1234-1234-123456789012';
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('APPLE_AUTH_ENV','dev');vi.stubEnv('WEB_ORIGIN',web);vi.stubEnv('APPLE_WEB_ENABLED','true');vi.stubEnv('NODE_ENV','production');mocks.guest.mockResolvedValue('guest-access');});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
it('starts through the BFF and stores proof only in a secure host-only HttpOnly cookie',async()=>{
  const fetch=vi.fn().mockResolvedValue(Response.json({success:true,data:{transactionId:id,authorizationUrl:'https://appleid.apple.com/auth/authorize?state=state'}}));vi.stubGlobal('fetch',fetch);
  const response=await POST(new NextRequest(web+'/api/auth/apple/start',{method:'POST',headers:{origin:web,'Content-Type':'application/json'},body:JSON.stringify({returnUrl:'/my-page'})}));
  expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store');
  expect(mocks.set).toHaveBeenCalledWith(APPLE_COOKIE,expect.any(String),expect.objectContaining({httpOnly:true,secure:true,sameSite:'lax',path:'/'}));
  const options=fetch.mock.calls[0][1];expect(options.headers.Authorization).toBe('Bearer guest-access');
  expect(options.body).not.toContain('codeVerifier');expect(options.body).toContain('codeChallenge');
  expect(JSON.stringify(await response.json())).not.toContain('verifier');
});
it('rejects cross-site start before contacting the API',async()=>{
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
  const response=await POST(new NextRequest(web+'/api/auth/apple/start',{method:'POST',headers:{origin:'https://attacker.test'},body:'{}'}));
  expect(response.status).toBeGreaterThanOrEqual(400);expect(fetch).not.toHaveBeenCalled();
});
it('exchanges server-to-server, writes existing session cookies and immediately redirects to a clean URL',async()=>{
  mocks.get.mockReturnValue({value:JSON.stringify({transactionId:id,verifier:'v'.repeat(43),expires:Date.now()+60_000,returnUrl:'/my-page'})});
  const fetch=vi.fn().mockResolvedValue(Response.json({success:true,data:{tokenInfo:{accessToken:'access-secret',refreshToken:'refresh-secret',accessTokenExpiresAt:new Date(Date.now()+60_000).toISOString(),refreshTokenExpiresAt:new Date(Date.now()+3600_000).toISOString()}}}));vi.stubGlobal('fetch',fetch);
  const response=await GET(new NextRequest(web+`/api/auth/apple/complete?transactionId=${id}&code=${'c'.repeat(43)}`));
  expect(response.status).toBe(303);expect(response.headers.get('location')).toBe(web+'/my-page');
  expect(response.headers.get('referrer-policy')).toBe('no-referrer');expect(response.headers.get('cache-control')).toBe('no-store');
  expect(mocks.set).toHaveBeenCalledWith('accessToken','access-secret',expect.objectContaining({httpOnly:true,secure:true,sameSite:'lax'}));
  expect(mocks.set).toHaveBeenCalledWith(APPLE_COOKIE,'',expect.objectContaining({maxAge:0}));
  expect(await response.text()).not.toContain('secret');
});
it.each(['missing-cookie','wrong-id','cancelled','bad-code'])('rejects %s without an exchange or leaking query data',async scenario=>{
  mocks.get.mockReturnValue(scenario==='missing-cookie'?undefined:{value:JSON.stringify({transactionId:scenario==='wrong-id'?'different':id,verifier:'v'.repeat(43),expires:Date.now()+60_000,returnUrl:'/my-page'})});
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
  const response=await GET(new NextRequest(web+`/api/auth/apple/complete?transactionId=${id}&code=${scenario==='bad-code'?'secret':'c'.repeat(43)}${scenario==='cancelled'?'&error=access_denied':''}`));
  expect(response.headers.get('location')).toBe(web+'/login?appleError=1');expect(fetch).not.toHaveBeenCalled();
  expect(mocks.set).not.toHaveBeenCalledWith('accessToken',expect.anything(),expect.anything());
});
