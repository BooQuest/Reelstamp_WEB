import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getMutableServerApiClient } from '@/app/lib/api/server-client';
import { authJson, authRouteError, requireSameOrigin } from '@/app/lib/auth/route-helpers';
import { clearTokenCookies } from '@/app/lib/auth/token-cookies';
export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const api = await getMutableServerApiClient();
    const response = await api.post('/api/auth/logout-all');
    clearTokenCookies(await cookies());
    return authJson(response.data);
  } catch (error) { return authRouteError(error); }
}
