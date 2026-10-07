import 'server-only';

function backendBaseUrl() {
  const configured = process.env.WEB_API_BASE_URL ||
    (process.env.NODE_ENV !== 'production' ? process.env.NEXT_PUBLIC_WEB_API_BASE_URL || 'http://localhost:8080' : '');
  if (!configured) throw new Error('WEB_API_BASE_URL is required in production');
  const url = new URL(configured);
  if (url.username || url.password || url.search || url.hash || !['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Invalid WEB_API_BASE_URL');
  }
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('WEB_API_BASE_URL must use HTTPS in production');
  }
  return configured.replace(/\/$/, '');
}

export const API_CONFIG = {
  get WEB_BASE_URL() { return backendBaseUrl(); },
  TIMEOUT: parseInt(process.env.API_TIMEOUT || '300000', 10),
} as const;
