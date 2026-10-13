const STORAGE_KEY = 'reelstamp:bgm-upload-guide:v1:dismissed';

export function isBgmGuideDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function dismissBgmGuide(): void {
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    // Unavailable storage must not prevent downloading or closing the guide.
  }
}
