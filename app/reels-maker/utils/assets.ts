import {
  TEMPLATE_ASSET_BASE_URL,
  VIDEO_ASSET_EXTENSIONS,
} from '../constants';
import type { GuideImageEntry } from '../types';

export const isVideoAssetUrl = (url: string) => {
  const path = url.trim().split(/[?#]/)[0]?.toLowerCase() ?? '';
  return VIDEO_ASSET_EXTENSIONS.some((extension) => path.endsWith(extension));
};

const isAbsoluteAssetUrl = (url: string) =>
  /^(https?:|blob:|data:)/i.test(url) || url.startsWith('/');

export const joinTemplateAssetUrl = (key: string) => {
  const trimmed = key.trim();
  if (!trimmed || isAbsoluteAssetUrl(trimmed) || !TEMPLATE_ASSET_BASE_URL) {
    return trimmed;
  }
  const base = TEMPLATE_ASSET_BASE_URL.endsWith('/')
    ? TEMPLATE_ASSET_BASE_URL.slice(0, -1)
    : TEMPLATE_ASSET_BASE_URL;
  const normalizedKey = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  return `${base}/${normalizedKey}`;
};

const extractGuideImageJson = (value: string) => {
  const trimmed = value.trim();
  const jsonStartIndex = trimmed.indexOf('[');
  if (jsonStartIndex === 0) return trimmed;
  if (jsonStartIndex > 0) return trimmed.slice(jsonStartIndex).trim();

  const base = TEMPLATE_ASSET_BASE_URL.endsWith('/')
    ? TEMPLATE_ASSET_BASE_URL.slice(0, -1)
    : TEMPLATE_ASSET_BASE_URL;
  if (!trimmed.startsWith(`${base}/`)) return null;

  const rest = trimmed.slice(base.length + 1).trim();
  return rest.startsWith('[') ? rest : null;
};

const readGuideStartSecond = (entry: Record<string, unknown>) => {
  const rawValue = entry.startSecond ?? entry.start_second ?? entry.start;
  if (rawValue == null || rawValue === '') return null;
  const value = typeof rawValue === 'number' ? rawValue : Number(rawValue);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.floor(value);
};

const normalizeGuideImageEntry = (value: unknown, order: number) => {
  if (typeof value === 'string') {
    const url = value.trim();
    return url
      ? { url: joinTemplateAssetUrl(url), startSecond: null, order }
      : null;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const entry = value as Record<string, unknown>;
  const url = typeof entry.url === 'string' ? entry.url.trim() : '';
  if (!url) return null;
  return {
    url: joinTemplateAssetUrl(url),
    startSecond: readGuideStartSecond(entry),
    order,
  };
};

export const parseGuideImageEntries = (
  rawValue?: string | null
): GuideImageEntry[] => {
  const value = rawValue?.trim();
  if (!value) return [];

  const jsonValue = extractGuideImageJson(value);
  if (jsonValue) {
    try {
      const parsed = JSON.parse(jsonValue);
      if (Array.isArray(parsed)) {
        return parsed
          .map((entry, index) => normalizeGuideImageEntry(entry, index))
          .filter(
            (entry): entry is GuideImageEntry & { order: number } =>
              Boolean(entry)
          )
          .sort((a, b) => {
            const aStart = a.startSecond ?? Number.POSITIVE_INFINITY;
            const bStart = b.startSecond ?? Number.POSITIVE_INFINITY;
            if (aStart !== bStart) return aStart - bStart;
            return a.order - b.order;
          })
          .map((entry) => ({
            url: entry.url,
            startSecond: entry.startSecond,
          }));
      }
    } catch {
      return [{ url: joinTemplateAssetUrl(value), startSecond: null }];
    }
  }

  return [{ url: joinTemplateAssetUrl(value), startSecond: null }];
};
