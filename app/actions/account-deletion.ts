'use server';

import { cookies, headers } from 'next/headers';
import { createHash, randomBytes } from 'node:crypto';
import { getMutableServerApiClient } from '@/app/lib/api/server-client';
import { DELETION_COOKIE, getDeletionContext, equalDeletionState, deletionErrorCode } from '@/app/lib/account-deletion/server';
import type { DeletionPreview, DeletionProof, DeletionResult, DeletionStarted } from '@/app/lib/account-deletion/types';
import { clearTokenCookies } from '@/app/lib/auth/token-cookies';
import { OAUTH_STATE_COOKIE } from '@/app/lib/auth/oauth-state';

const validUser = (id: number) => Number.isSafeInteger(id) && id > 0;
const authFailure = { success: false, errorCode: 'RS-ACC-001' } as const;

export async function getDeletionPreviewAction(userId: number): Promise<DeletionResult<DeletionPreview>> {
  if (!validUser(userId)) return authFailure;
  try {
    const api = await getMutableServerApiClient({ expectedUserId: userId });
    const response = await api.get('/api/user/me/deletion-preview', { headers: { 'Cache-Control': 'no-store' } });
    if (!response.data.success || !response.data.data) return { success: false, errorCode: 'RS-ACC-003' };
    return { success: true, data: response.data.data };
  } catch (error) { return { success: false, errorCode: deletionErrorCode(error) }; }
}

export async function startDeletionReauthenticationAction(userId: number): Promise<DeletionResult<DeletionStarted>> {
  if (!validUser(userId)) return authFailure;
  try {
    // Next Server Actions enforce Origin/Host matching. The Backend additionally
    // checks this exact /login callback against its configured web origin allowlist.
    const origin = (await headers()).get('origin');
    if (!origin || !['http:', 'https:'].includes(new URL(origin).protocol)) return authFailure;
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    const api = await getMutableServerApiClient({ expectedUserId: userId, retryAuthentication: false });
    const response = await api.post('/api/user/me/deletion-reauth', {
      purpose: 'account_deletion', platform: 'web', redirectUri: `${new URL(origin).origin}/login`, codeChallenge,
    });
    const data = response.data.data as DeletionStarted;
    if (!response.data.success || data?.purpose !== 'account_deletion' || !data.transactionId || !data.state || !data.authorizationUrl)
      return { success: false, errorCode: 'RS-ACC-003' };
    (await cookies()).set(DELETION_COOKIE, JSON.stringify({
      purpose: data.purpose, userId, transactionId: data.transactionId, state: data.state,
      codeVerifier, expiresAt: Date.now() + 600_000,
    }), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 600 });
    return { success: true, data };
  } catch (error) { return { success: false, errorCode: deletionErrorCode(error) }; }
}

export async function deleteAccountAction(userId: number, proof?: DeletionProof): Promise<DeletionResult> {
  if (!validUser(userId)) return authFailure;
  try {
    let data;
    if (proof) {
      const context = await getDeletionContext();
      if (!context || context.expiresAt <= Date.now() || context.userId !== userId ||
          context.transactionId !== proof.transactionId || !equalDeletionState(context.state, proof.state) ||
          typeof proof.code !== 'string' || !proof.code || proof.code.length > 8192) return authFailure;
      data = { transactionId: proof.transactionId, state: proof.state, code: proof.code, codeVerifier: context.codeVerifier };
    }
    // Refresh before dispatch is allowed; never replay a DELETE after any response
    // or ambiguous timeout. Backend proof consumption is also single-use.
    const api = await getMutableServerApiClient({ expectedUserId: userId, retryAuthentication: false });
    const response = await api.delete('/api/user/me', { data, timeout: 60_000 });
    if (!response.data.success || response.data.data?.userDeleted !== true)
      return { success: false, errorCode: 'RS-ACC-003' };
    const store = await cookies();
    clearTokenCookies(store);
    store.delete(DELETION_COOKIE);
    store.delete(OAUTH_STATE_COOKIE);
    return { success: true, data: undefined };
  } catch (error) { return { success: false, errorCode: deletionErrorCode(error) }; }
}
