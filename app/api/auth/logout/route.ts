import { NextRequest } from 'next/server';
import { logoutAction } from '@/app/actions/auth';
import { authJson, authRouteError, requireSameOrigin } from '@/app/lib/auth/route-helpers';
import { unavailableAuth } from '@/app/lib/auth/server-errors';

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const result = await logoutAction();
    if (!result.success) throw unavailableAuth();
    return authJson(result);
  } catch (error) { return authRouteError(error); }
}
