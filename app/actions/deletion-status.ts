'use server';
import { cookies } from 'next/headers';
import axios from 'axios';
import { API_CONFIG } from '@/app/lib/constants/api';
import { getMutableServerApiClient } from '@/app/lib/api/server-client';
import type { DeletionProgress } from '@/app/lib/account-deletion/types';

const COOKIE = 'account-deletion-receipt';
export async function prepareDeletionAction(userId: number) {
  const api = await getMutableServerApiClient({ expectedUserId: userId, retryAuthentication: false });
  try {
    const response = await api.post('/api/user/me/deletion-prepare');
    const data = response.data?.data;
    if (data?.supported === false) { (await cookies()).delete(COOKIE); return; }
    if (!data?.deletionRequestId || !/^[A-Za-z0-9_-]{43}$/.test(data.receipt)) throw new Error('Invalid deletion preparation');
    (await cookies()).set(COOKIE, JSON.stringify({ ...data, userId }), {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/',
    });
  } catch (error) {
    // Only a genuinely older server lacks this API. Never bypass a new server's failure.
    if (axios.isAxiosError(error) && error.response?.status === 404) { (await cookies()).delete(COOKIE); return; }
    throw error;
  }
}
export async function deletionReceiptForUser(userId: number): Promise<string | undefined> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return;
  const record = JSON.parse(value);
  if (record.userId !== userId) throw new Error('Deletion account mismatch');
  return record.deletionRequestId;
}
export async function getDeletionStatusAction(): Promise<DeletionProgress | null> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return null;
  const { receipt } = JSON.parse(value);
  const response = await axios.post(`${API_CONFIG.WEB_BASE_URL}/api/account-deletions/status`, { receipt }, { timeout: 15000 });
  if (!response.data?.success) throw new Error('Deletion status unavailable');
  const status = response.data.data as DeletionProgress;
  // Do not clear a newly signed-in account when checking an earlier withdrawal.
  // The original DELETE handles local logout; an expired session is cleared by normal auth.
  return status;
}
export async function acknowledgeDeletionAction(): Promise<void> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return;
  const { receipt } = JSON.parse(value);
  await axios.post(`${API_CONFIG.WEB_BASE_URL}/api/account-deletions/acknowledge`, { receipt }, { timeout: 15000 });
  (await cookies()).delete(COOKIE);
}
