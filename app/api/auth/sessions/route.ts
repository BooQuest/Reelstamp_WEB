import { getMutableServerApiClient } from '@/app/lib/api/server-client';
import { authJson, authRouteError } from '@/app/lib/auth/route-helpers';
export async function GET() {
  try {
    const api = await getMutableServerApiClient();
    return authJson((await api.get('/api/auth/sessions')).data);
  } catch (error) { return authRouteError(error); }
}
