
export type SocialAuthProvider = 'KAKAO' | 'NAVER' | 'GOOGLE' | 'APPLE';
export type AuthProvider = SocialAuthProvider | 'GUEST';

export interface LoginRequest {
  accessToken: string;
  provider: SocialAuthProvider;
  guestAccessToken?: string;
}

export interface GuestLoginRequest {
  nickname: string;
}

// Web API 실제 응답 구조
export interface WebApiResponse<T> {
  success: boolean;
  status: number;
  message: string;
  errorCode?: string | null;
  data: T;
}

export interface TokenInfo {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  sessionId: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}

export interface UserInfo {
  id: number;
  userId?: number;
  provider: AuthProvider;
  providerUserId: string;
  email: string;
  nickname: string;
  socialNickname: string;
  profileImageUrl: string;
  role: string;
  guest: boolean;
}

export interface LoginResponseData {
  tokenInfo: TokenInfo;
  userInfo: UserInfo;
}

export interface SubscriptionData {
  status: string;
  active: boolean;
  currentPeriodStart: string;
  nextBillingDate: string;
  validUntil: string;
  canceledAt?: string;
  billingKey?: string; // 추가
  orderId?: string;    // 추가
}

export interface SubscriptionStatusResponse {
  passActive?: boolean;
  subscription: SubscriptionData;
  subscriptionPlan: {
    plan: string;
    name: string;
    description: string;
    price: {
      fakePrice: number;
      regularPrice: number;
      openPrice: number;
    };
  };
}

export interface RefreshTokenResponse {
  tokenInfo: TokenInfo;
}

// 하위 호환성을 위한 간단한 인터페이스
export interface LoginResponse {
  accessToken?: string;
  refreshToken?: string;
  user?: {
    id: string;
    email?: string;
    name?: string;
  };
}

type UserInfoLike = Partial<Omit<UserInfo, 'id' | 'provider' | 'guest'>> & {
  id?: number | string;
  userId?: number | string;
  provider?: AuthProvider | string;
  guest?: boolean;
};

type ApiErrorLike = {
  message?: string;
  response?: {
    status?: number;
    statusText?: string;
    data?: unknown;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return value !== null && typeof value === 'object';
};

const toUserInfoLike = (raw: unknown): UserInfoLike => {
  return isRecord(raw) ? (raw as UserInfoLike) : {};
};

const toApiErrorLike = (error: unknown): ApiErrorLike => {
  return isRecord(error) ? (error as ApiErrorLike) : {};
};

export function normalizeUserInfo(raw: unknown, fallbackProvider?: AuthProvider): UserInfo {
  const source = toUserInfoLike(raw);
  const id = Number(source.id ?? source.userId);
  const provider = (source.provider ?? fallbackProvider ?? 'KAKAO') as AuthProvider;

  return {
    ...source,
    id,
    userId: id,
    provider,
    providerUserId: source.providerUserId ?? '',
    email: source.email ?? '',
    nickname: source.nickname ?? '',
    socialNickname: source.socialNickname ?? '',
    profileImageUrl: source.profileImageUrl ?? '',
    role: source.role ?? 'USER',
    guest: Boolean(source.guest || provider === 'GUEST'),
  };
}

/**
 * 서버 사이드에서 현재 로그인한 유저 정보를 조회합니다.
 * httpOnly 쿠키의 accessToken을 사용하여 Spring API를 호출합니다.
 * 렌더링에서는 proxy가 갱신하며, API/Action은 mutable 문맥을 명시합니다.
 */
export async function getCurrentUser(mutable = false): Promise<UserInfo | null> {
  try {
    // 쿠키 확인
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value;
    const refreshToken = cookieStore.get('refreshToken')?.value;
    
    // access token과 refresh token이 모두 없으면 null 반환
    if (!accessToken && !refreshToken) {
      return null;
    }

    const { getServerApiClient, getMutableServerApiClient } = await import('@/app/lib/api/server-client');
    const apiClient = await (mutable ? getMutableServerApiClient() : getServerApiClient());
    const response = await apiClient.get<WebApiResponse<UserInfo>>('/api/user/me');
    
    if (response.data && response.data.data) {
      return normalizeUserInfo(response.data.data);
    }

    return null;
  } catch (error: unknown) {
    const { unstable_rethrow } = await import('next/navigation');
    unstable_rethrow(error);
    const status = toApiErrorLike(error).response?.status;
    if (status === 401) return null;
    throw new Error('로그인 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }
}
