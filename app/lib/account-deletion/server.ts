import 'server-only';
import { cookies } from 'next/headers';
import { timingSafeEqual } from 'node:crypto';
import { parseLoginOauthState } from '@/app/lib/auth/loginRedirect';
import type { DeletionErrorCode } from './types';

export const DELETION_COOKIE = 'reelstamp-account-deletion';
export interface DeletionContext {
  purpose: 'account_deletion';
  transactionId: string;
  userId: number;
  state: string;
  codeVerifier: string;
  expiresAt: number;
}

export async function getDeletionContext(): Promise<DeletionContext | null> {
  try {
    const raw = (await cookies()).get(DELETION_COOKIE)?.value;
    const value = raw ? JSON.parse(raw) : null;
    if (value?.purpose !== 'account_deletion' || !Number.isSafeInteger(value.userId) ||
        typeof value.transactionId !== 'string' || typeof value.state !== 'string' ||
        typeof value.codeVerifier !== 'string' || !Number.isFinite(value.expiresAt)) return null;
    return value;
  } catch { return null; }
}

export function equalDeletionState(a: string, b: unknown): boolean {
  if (typeof b !== 'string') return false;
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Pending deletion callbacks must render even while the user remains signed in.
 * Ordinary login states retain their existing flow, including in another tab. */
export async function isDeletionCallback(params: { code?: string; state?: string; error?: string }) {
  return Boolean((params.code || params.state || params.error) &&
    !parseLoginOauthState(typeof params.state === 'string' ? params.state : null) && (await getDeletionContext() || params.state));
}

export function deletionErrorCode(error: unknown): DeletionErrorCode {
  const response = (error as { response?: { status?: number; data?: { errorCode?: string } } })?.response;
  const code = response?.data?.errorCode;
  if (code === 'RS-ACC-002') return code;
  if (code === 'RS-ACC-001' || code === 'AUTH_ACCOUNT_CHANGED' || response?.status === 401) return 'RS-ACC-001';
  return 'RS-ACC-003';
}
