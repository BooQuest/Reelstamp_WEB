import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getMutableServerApiClient } from '@/app/lib/api/server-client';
import { authJson, authRouteError, requireSameOrigin } from '@/app/lib/auth/route-helpers';
import { clearTokenCookies } from '@/app/lib/auth/token-cookies';
import { AuthRequestError } from '@/app/lib/auth/server-errors';
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    requireSameOrigin(request);
    const { sessionId } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(sessionId)) throw new AuthRequestError(400, 'INVALID_REQUEST', 'Invalid session');
    const api = await getMutableServerApiClient();
    const current = (await api.get('/api/auth/session')).data.data;
    const response = await api.delete(`/api/auth/sessions/${sessionId}`);
    if (current.sessionId === sessionId) clearTokenCookies(await cookies());
    return authJson(response.data);
  } catch (error) { return authRouteError(error); }
}
