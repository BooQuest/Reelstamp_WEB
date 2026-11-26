// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
vi.mock('@/app/lib/constants/api', () => ({ API_CONFIG: { WEB_BASE_URL: 'https://api-dev.reelstamp.co.kr' } }));
import { appleEnvironment, appleWebEnabled, createAppleProof, parseAppleProof } from './apple';
beforeEach(() => { vi.stubEnv('APPLE_AUTH_ENV', 'dev'); vi.stubEnv('WEB_ORIGIN', 'https://web.example.test'); vi.stubEnv('APPLE_WEB_ENABLED', 'false'); });
afterEach(() => vi.unstubAllEnvs());
it('uses configured origins and never enables PROD without the release gate', () => {
  expect(appleEnvironment().apiOrigin).toBe('https://api-dev.reelstamp.co.kr');
  expect(appleWebEnabled()).toBe(false);
  vi.stubEnv('APPLE_WEB_ENABLED', 'true'); expect(appleWebEnabled()).toBe(true);
  vi.stubEnv('APPLE_AUTH_ENV', 'prod'); expect(appleWebEnabled()).toBe(false);
  expect(appleEnvironment().webOrigin).toBe('https://web.example.test');
});
it.each(['', 'http://web.example.test', 'https://user@web.example.test', 'https://web.example.test/path', 'https://web.example.test?x=1', 'https://web.example.test#fragment'])('rejects unsafe or missing WEB_ORIGIN: %s', origin => {
  vi.stubEnv('WEB_ORIGIN', origin);
  expect(() => appleEnvironment()).toThrow();
});
it('creates unpredictable S256 proof and rejects external return destinations', () => {
  const a=createAppleProof('https://attacker.test'), b=createAppleProof('//attacker.test');
  expect(a.verifier).not.toBe(b.verifier);
  expect(a.challenge).toBe(createHash('sha256').update(a.verifier).digest('base64url'));
  expect(a.returnUrl.startsWith('/')).toBe(true);expect(a.returnUrl).not.toContain('attacker');
});
it('requires the browser cookie, matching transaction, valid verifier and expiry', () => {
  const id='12345678-1234-1234-1234-123456789012';
  const proof={transactionId:id,verifier:'v'.repeat(43),expires:Date.now()+60_000,returnUrl:'/my-page'};
  expect(parseAppleProof(JSON.stringify(proof),id).returnUrl).toBe('/my-page');
  expect(() => parseAppleProof(undefined,id)).toThrow();
  expect(() => parseAppleProof(JSON.stringify(proof),'other')).toThrow();
  expect(() => parseAppleProof(JSON.stringify({...proof,expires:Date.now()-1}),id)).toThrow();
  expect(() => parseAppleProof(JSON.stringify({...proof,verifier:'short'}),id)).toThrow();
});
