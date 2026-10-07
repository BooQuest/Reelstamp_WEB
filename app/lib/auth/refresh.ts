import 'server-only';
import axios from 'axios';
import { API_CONFIG } from '@/app/lib/constants/api';
import type { TokenInfo } from '@/app/lib/api/auth';
import { expiredAuth, unavailableAuth } from './server-errors';

export function requireTokenInfo(value: unknown): TokenInfo {
  const info = value as TokenInfo | undefined;
  const accessEnd = Date.parse(info?.accessTokenExpiresAt ?? '');
  const sessionEnd = Date.parse(info?.refreshTokenExpiresAt ?? '');
  if (!info || typeof info.accessToken !== 'string' || !info.accessToken ||
      typeof info.refreshToken !== 'string' || !info.refreshToken || typeof info.sessionId !== 'string' ||
      !info.sessionId || !Number.isFinite(accessEnd) || !Number.isFinite(sessionEnd) ||
      accessEnd > sessionEnd || sessionEnd <= Date.now() || !Number.isFinite(info.expiresIn) || info.expiresIn < 0) {
    throw unavailableAuth();
  }
  return info;
}

export async function refreshTokens(refreshToken: string): Promise<TokenInfo> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await axios.post(`${API_CONFIG.WEB_BASE_URL}/api/auth/token/refresh`, null, {
        headers: { 'X-Refresh-Token': refreshToken }, timeout: 8_000,
      });
      if (!response.data?.success) throw unavailableAuth();
      return requireTokenInfo(response.data.data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) throw expiredAuth();
      // Retry only the authentication exchange; the Backend grace window makes it idempotent.
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      if (attempt === 0 && axios.isAxiosError(error) && (!status || status >= 500)) continue;
      throw unavailableAuth();
    }
  }
  throw unavailableAuth();
}
