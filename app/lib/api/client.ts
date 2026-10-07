import 'server-only';
import axios from 'axios';
import { API_CONFIG } from '@/app/lib/constants/api';

// Authentication payloads and Axios error objects contain credentials. Never log them.
export const webApiClient = axios.create({
  baseURL: API_CONFIG.WEB_BASE_URL,
  timeout: 8_000,
  headers: { 'Content-Type': 'application/json' },
});
