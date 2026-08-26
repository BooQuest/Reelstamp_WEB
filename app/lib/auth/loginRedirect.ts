export const LOGIN_HOME_PATH = '/all-templates';

const LOGIN_RETURN_URL_STORAGE_KEY = 'reelstamp:login-return-url';
const LEGACY_LOGIN_RETURN_URL_STORAGE_KEY = 'previousPath';

export type LoginOAuthProvider = 'KAKAO' | 'NAVER' | 'GOOGLE';
export type LoginOAuthStatePrefix = 'kakao' | 'naver' | 'google';

export type ParsedLoginOAuthState = {
  provider: LoginOAuthProvider;
  returnUrl: string | null;
};

const OAUTH_STATE_PREFIX_TO_PROVIDER: Record<LoginOAuthStatePrefix, LoginOAuthProvider> = {
  kakao: 'KAKAO',
  naver: 'NAVER',
  google: 'GOOGLE',
};

export const getSafeLoginReturnUrl = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null;
  if (trimmed.startsWith('/login')) return null;
  return trimmed;
};

export const getLoginReturnUrlFromSearchParams = (searchParams: URLSearchParams) =>
  getSafeLoginReturnUrl(searchParams.get('returnUrl'));

export const buildLoginReturnHref = (returnUrl: string) =>
  `/login?returnUrl=${encodeURIComponent(returnUrl)}`;

export const buildLoginOauthState = (
  prefix: LoginOAuthStatePrefix,
  nonce: string,
  returnUrl: string | null | undefined
) => {
  const safeReturnUrl = getSafeLoginReturnUrl(returnUrl);
  return safeReturnUrl
    ? `${prefix}_${nonce}.${encodeURIComponent(safeReturnUrl)}`
    : `${prefix}_${nonce}`;
};

export const parseLoginOauthState = (
  state: string | null | undefined
): ParsedLoginOAuthState | null => {
  if (!state) return null;

  const prefix = (['kakao', 'naver', 'google'] as const).find((item) =>
    state.startsWith(`${item}_`)
  );
  if (!prefix) return null;

  const payload = state.slice(prefix.length + 1);
  const separatorIndex = payload.indexOf('.');
  if (separatorIndex < 0) {
    return {
      provider: OAUTH_STATE_PREFIX_TO_PROVIDER[prefix],
      returnUrl: null,
    };
  }

  try {
    return {
      provider: OAUTH_STATE_PREFIX_TO_PROVIDER[prefix],
      returnUrl: getSafeLoginReturnUrl(decodeURIComponent(payload.slice(separatorIndex + 1))),
    };
  } catch {
    return {
      provider: OAUTH_STATE_PREFIX_TO_PROVIDER[prefix],
      returnUrl: null,
    };
  }
};

export const storeLoginReturnUrl = (returnUrl: string | null | undefined) => {
  if (typeof window === 'undefined') return;

  const safeReturnUrl = getSafeLoginReturnUrl(returnUrl);
  if (!safeReturnUrl) return;

  sessionStorage.setItem(LOGIN_RETURN_URL_STORAGE_KEY, safeReturnUrl);
};

export const getStoredLoginReturnUrl = () => {
  if (typeof window === 'undefined') return null;

  return (
    getSafeLoginReturnUrl(sessionStorage.getItem(LOGIN_RETURN_URL_STORAGE_KEY)) ??
    getSafeLoginReturnUrl(sessionStorage.getItem(LEGACY_LOGIN_RETURN_URL_STORAGE_KEY))
  );
};

export const clearStoredLoginReturnUrl = () => {
  if (typeof window === 'undefined') return;

  sessionStorage.removeItem(LOGIN_RETURN_URL_STORAGE_KEY);
  sessionStorage.removeItem(LEGACY_LOGIN_RETURN_URL_STORAGE_KEY);
};

export const consumeStoredLoginReturnUrl = () => {
  const returnUrl = getStoredLoginReturnUrl();
  clearStoredLoginReturnUrl();
  return returnUrl;
};
