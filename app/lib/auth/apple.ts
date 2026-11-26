import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { API_CONFIG } from '@/app/lib/constants/api';
import { getSafeLoginReturnUrl, LOGIN_HOME_PATH } from './loginRedirect';

export const APPLE_COOKIE = '__Host-reelstamp-apple';
export const APPLE_HEADERS = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
export type AppleProof = { transactionId: string; verifier: string; expires: number; returnUrl: string };

export function appleEnvironment() {
  const environment = process.env.APPLE_AUTH_ENV || 'dev';
  if (!['dev', 'prod'].includes(environment)) throw new Error('Invalid Apple environment');
  const webOrigin = httpsOrigin(process.env.WEB_ORIGIN || '', 'WEB_ORIGIN');
  const apiOrigin = httpsOrigin(API_CONFIG.WEB_BASE_URL, 'WEB_API_BASE_URL');
  return { environment, webOrigin, apiOrigin };
}
function httpsOrigin(value: string, name: string) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.origin !== value) throw new Error(`${name} must be an HTTPS origin without a path or credentials`);
  return value;
}
export function appleWebEnabled() {
  return process.env.APPLE_WEB_ENABLED === 'true' &&
    (process.env.APPLE_AUTH_ENV !== 'prod' || process.env.APPLE_RELEASE_APPROVED === 'true');
}
export async function appleRequest<T>(path: string, body?: unknown, guest?: string): Promise<T> {
  const { apiOrigin } = appleEnvironment();
  const response = await fetch(`${apiOrigin}/api/auth/apple/web/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(guest ? { Authorization: `Bearer ${guest}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20_000),
  });
  const result = await response.json();
  if (!response.ok || !result?.success || !result.data) throw new Error('Apple authentication unavailable');
  return result.data as T;
}
export async function appleWebAvailable(): Promise<boolean> {
  if (!appleWebEnabled()) return false;
  try { return (await appleRequest<{ enabled: boolean }>('config')).enabled === true; }
  catch { return false; }
}
export function createAppleProof(returnUrl: unknown) {
  const verifier = randomBytes(32).toString('base64url');
  return {
    verifier, challenge: createHash('sha256').update(verifier).digest('base64url'),
    returnUrl: getSafeLoginReturnUrl(typeof returnUrl === 'string' ? returnUrl : null) ?? LOGIN_HOME_PATH,
  };
}
export function parseAppleProof(raw: string | undefined, transactionId: string | null): AppleProof {
  if (!raw || raw.length > 4096) throw new Error('Missing Apple verification cookie');
  const proof = JSON.parse(raw) as AppleProof;
  if (!transactionId || proof.transactionId !== transactionId ||
      !/^[0-9a-f-]{36}$/.test(transactionId) || typeof proof.verifier !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(proof.verifier) ||
      !Number.isFinite(proof.expires) || proof.expires <= Date.now() || proof.expires > Date.now() + 600_000) {
    throw new Error('Invalid Apple verification cookie');
  }
  return { ...proof, returnUrl: getSafeLoginReturnUrl(proof.returnUrl) ?? LOGIN_HOME_PATH };
}
