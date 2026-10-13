export type RecommendedBgm = { title: string; url: string };

export function resolveRecommendedBgm(
  title?: string | null,
  rawUrl?: string | null,
): RecommendedBgm | null {
  if (!title?.trim() || !rawUrl?.trim()) return null;
  try {
    const url = new URL(rawUrl.trim());
    if (
      url.protocol !== 'https:' ||
      !['instagram.com', 'www.instagram.com'].includes(url.hostname) ||
      url.username || url.password || url.port ||
      !/^\/reels\/audio\/[0-9]+\/?$/.test(url.pathname)
    ) return null;
    return {
      title: title.trim(),
      url: `https://www.instagram.com${url.pathname.replace(/\/$/, '')}/`,
    };
  } catch {
    return null;
  }
}

// Keep this synchronous: opening Instagram must retain the user's click activation.
export function openBgmPage(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}
