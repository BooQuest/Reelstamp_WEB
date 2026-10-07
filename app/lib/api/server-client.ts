import 'server-only';
import axios, { type AxiosInstance } from 'axios';
import { cookies, headers } from 'next/headers';
import { API_CONFIG } from '@/app/lib/constants/api';
import { refreshTokens } from '@/app/lib/auth/refresh';
import { clearTokenCookies, saveTokenCookies, shouldRefreshAccessToken } from '@/app/lib/auth/token-cookies';
import { errorStatus, expiredAuth } from '@/app/lib/auth/server-errors';

/** Rendering uses this read-only client; cookie-writing contexts opt in explicitly. */
export async function getServerApiClient(): Promise<AxiosInstance> {
  return createClient(false);
}

/** Only call from Route Handlers or Server Actions. */
export async function getMutableServerApiClient(): Promise<AxiosInstance> {
  return createClient(true);
}

async function createClient(mutable: boolean): Promise<AxiosInstance> {
  const store = await cookies();
  const expectedUser = mutable ? (await headers()).get('x-reelstamp-user') : null;
  let accessToken = store.get('accessToken')?.value;
  let refreshToken = store.get('refreshToken')?.value;
  let pendingRefresh: Promise<void> | undefined;

  const refresh = () => pendingRefresh ??= (async () => {
    if (!mutable || !refreshToken) throw expiredAuth();
    try {
      const info = await refreshTokens(refreshToken);
      saveTokenCookies(store, info);
      accessToken = info.accessToken;
      refreshToken = info.refreshToken;
    } catch (error) {
      if (errorStatus(error) === 401) clearTokenCookies(store);
      throw error;
    }
  })().finally(() => { pendingRefresh = undefined; });

  const client = axios.create({ baseURL: API_CONFIG.WEB_BASE_URL, timeout: API_CONFIG.TIMEOUT });
  client.interceptors.request.use(async config => {
    if (refreshToken && shouldRefreshAccessToken(accessToken) && !(config as typeof config & { _authRetry?: boolean })._authRetry) {
      if (mutable) await refresh();
      else if (!accessToken) throw expiredAuth();
    }
    // Use the refreshed value, never overwrite it by rereading an old request cookie.
    if (expectedUser) config.headers['X-Reelstamp-User'] = expectedUser;
    if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
    return config;
  });
  client.interceptors.response.use(response => response, async error => {
    const request = error.config;
    const code = error.response?.data?.errorCode;
    if (mutable && refreshToken && request && !request._authRetry && error.response?.status === 401 &&
        ['INVALID_TOKEN', 'TOKEN_EXPIRED', 'MISSING_AUTH_TOKEN'].includes(code)) {
      request._authRetry = true;
      await refresh();
      return client(request);
    }
    throw error;
  });
  return client;
}
