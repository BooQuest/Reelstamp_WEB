import 'server-only';
import { API_CONFIG } from '@/app/lib/constants/api';
import { getServerApiClient } from '@/app/lib/api/server-client';
import { parseProducts, type PassGrant } from './catalog';
export async function getPassProducts() {
  const response = await fetch(
    `${API_CONFIG.WEB_BASE_URL}/api/subscription/plans`,
    {
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok) throw new Error('Catalog unavailable');
  const body = await response.json();
  if (!body.success) throw new Error('Catalog unavailable');
  return parseProducts(body.data?.plans);
}
export async function getPassAvailability() {
  try {
    const api = await getServerApiClient();
    const { data } = await api.get('/api/passes/availability');
    if (!data.success) throw new Error('Sales unavailable');
    return {
      canPurchase: data.data.canPurchase === true,
      allowedProductCodes: Array.isArray(data.data.allowedProductCodes)
        ? data.data.allowedProductCodes.filter(
            (code: unknown): code is string => typeof code === 'string',
          )
        : [],
      covered: data.data.covered !== false,
    };
  } catch {
    return {
      canPurchase: false,
      allowedProductCodes: [] as string[],
      covered: true,
    };
  }
}
export async function getPassGrants(): Promise<{
  grants: PassGrant[];
  now: number;
}> {
  const api = await getServerApiClient();
  const { data } = await api.get('/api/passes/grants');
  if (!data.success || !Array.isArray(data.data))
    throw new Error('Grants unavailable');
  return { grants: data.data, now: Date.now() };
}
