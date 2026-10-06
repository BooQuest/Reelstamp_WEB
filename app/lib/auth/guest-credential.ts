import 'server-only';
import { cookies } from 'next/headers';
import { getMutableServerApiClient } from '@/app/lib/api/server-client';
import { errorStatus } from './server-errors';

/** Preserve guest ownership through refresh before linking to a verified social identity. */
export async function getGuestCredential() {
  const store = await cookies();
  if (!store.has('accessToken') && !store.has('refreshToken')) return undefined;
  try {
    const api = await getMutableServerApiClient();
    const response = await api.get('/api/auth/session');
    return response.data.data?.userInfo?.guest ? store.get('accessToken')?.value : undefined;
  } catch (error) {
    if (errorStatus(error) === 401) return undefined;
    throw error;
  }
}
