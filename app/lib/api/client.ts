import 'server-only';
import axios, { type AxiosInstance } from 'axios';
import { API_CONFIG } from '@/app/lib/constants/api';

let webApiClient: AxiosInstance | undefined;

// Resolve the server-only URL on the first auth request. Next.js also imports these modules at build time.
// Authentication payloads and Axios errors contain credentials. Never log them.
export function getWebApiClient(): AxiosInstance {
  return webApiClient ??= axios.create({
    baseURL: API_CONFIG.WEB_BASE_URL,
    timeout: 8_000,
    headers: { 'Content-Type': 'application/json' },
  });
}
