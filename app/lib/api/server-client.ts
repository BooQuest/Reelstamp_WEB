// 서버 사이드 API 클라이언트: httpOnly 쿠키에서 토큰을 자동으로 추출하여 API 요청에 포함
import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';
import { cookies } from 'next/headers';
import { API_CONFIG } from '@/app/lib/constants/api';
import { WebApiResponse, TokenInfo } from '@/app/lib/api/auth';
import { setupInterceptors } from '@/app/lib/api/client';

type AuthRefreshFailure = {
  status: number;
  message: string;
  errorCode: string;
};

type AuthRefreshErrorBody = {
  success: false;
  status: number;
  message: string;
  errorCode: string;
  data: null;
};

type RefreshAccessTokenResult =
  | {
      tokenInfo: TokenInfo;
      error?: never;
    }
  | {
      tokenInfo: null;
      error: AuthRefreshFailure;
    };

const AUTH_REFRESH_EXPIRED_MESSAGE =
  '로그인이 만료되었습니다. 다시 로그인해주세요.';

class ServerAuthRefreshError extends Error {
  response: {
    status: number;
    data: AuthRefreshErrorBody;
  };

  constructor(failure: AuthRefreshFailure) {
    super(failure.message);
    this.name = 'ServerAuthRefreshError';
    this.response = {
      status: failure.status,
      data: {
        success: false,
        status: failure.status,
        message: failure.message,
        errorCode: failure.errorCode,
        data: null,
      },
    };
  }
}

function buildAuthRefreshFailure(
  overrides: Partial<AuthRefreshFailure> = {}
): AuthRefreshFailure {
  return {
    status: 401,
    message: AUTH_REFRESH_EXPIRED_MESSAGE,
    errorCode: 'INVALID_TOKEN',
    ...overrides,
  };
}

function getRefreshFailureFromError(error: unknown): AuthRefreshFailure {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as Partial<AuthRefreshErrorBody> | undefined;
    const message =
      typeof data?.message === 'string' && data.message.trim().length > 0
        ? data.message
        : AUTH_REFRESH_EXPIRED_MESSAGE;
    const errorCode =
      typeof data?.errorCode === 'string' && data.errorCode.trim().length > 0
        ? data.errorCode
        : 'INVALID_TOKEN';

    return buildAuthRefreshFailure({
      message,
      errorCode,
    });
  }

  return buildAuthRefreshFailure();
}

/**
 * 토큰 갱신 함수: refresh token을 사용하여 새로운 access token 발급
 * 
 * API 응답 구조:
 * {
 *   "success": true,
 *   "status": 0,
 *   "message": "string",
 *   "errorCode": "string",
 *   "data": {
 *     "accessToken": "string",
 *     "refreshToken": "string",
 *     "tokenType": "string",
 *     "expiresIn": 0
 *   }
 * }
 */
async function refreshAccessToken(
  refreshToken: string
): Promise<RefreshAccessTokenResult> {
  try {
    const response = await axios.post<WebApiResponse<{
      accessToken: string;
      refreshToken: string;
      tokenType: string;
      expiresIn: number;
    }>>(
      `${API_CONFIG.WEB_BASE_URL}/api/auth/token/refresh`,
      null,
      {
        headers: {
          'X-Refresh-Token': refreshToken,
          'Content-Type': 'application/json',
        },
        timeout: API_CONFIG.TIMEOUT,
      }
    );

    if (response.data.success && response.data.data) {
      const { accessToken, refreshToken: newRefreshToken, tokenType, expiresIn } = response.data.data;
      return {
        tokenInfo: {
          accessToken,
          refreshToken: newRefreshToken,
          tokenType,
          expiresIn,
        },
      };
    }
    return {
      tokenInfo: null,
      error: buildAuthRefreshFailure({
        message: response.data.message || AUTH_REFRESH_EXPIRED_MESSAGE,
        errorCode: response.data.errorCode || 'INVALID_TOKEN',
      }),
    };
  } catch (error) {
    console.error('[refreshAccessToken] 토큰 갱신 실패:', error);
    return {
      tokenInfo: null,
      error: getRefreshFailureFromError(error),
    };
  }
}

/**
 * 서버 사이드에서 사용할 API 클라이언트를 생성합니다.
 * httpOnly 쿠키에서 accessToken을 자동으로 추출하여 Authorization 헤더에 추가합니다.
 * access token 만료 시 자동으로 refresh token으로 갱신합니다.
 */
export async function getServerApiClient(): Promise<AxiosInstance> {
  const client = axios.create({
    baseURL: API_CONFIG.WEB_BASE_URL,
    timeout: API_CONFIG.TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  let isRefreshing = false;
  let failedQueue: Array<{
    resolve: (value: string | null) => void;
    reject: (error?: unknown) => void;
  }> = [];

  const processQueue = (error: unknown, token: string | null = null) => {
    failedQueue.forEach((prom) => {
      if (error) {
        prom.reject(error);
      } else {
        prom.resolve(token);
      }
    });
    failedQueue = [];
  };

  client.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      try {
        const cookieStore = await cookies();
        const accessToken = cookieStore.get('accessToken')?.value;
        
        if (accessToken) {
          config.headers.Authorization = `Bearer ${accessToken}`;
        }
      } catch {
        // 토큰 추출 실패 시 무시하고 진행
      }

      return config;
    },
    (error) => Promise.reject(error)
  );

  // 응답 인터셉터: 401 에러 시 토큰 갱신
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

      // 401 Unauthorized 에러이고, 아직 재시도하지 않은 요청인 경우
      if (error.response?.status === 401 && !originalRequest._retry) {
        if (isRefreshing) {
          // 이미 토큰 갱신 중이면 대기
          return new Promise<string | null>((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              if (originalRequest.headers && token) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              return client(originalRequest);
            })
            .catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const cookieStore = await cookies();
          const refreshToken = cookieStore.get('refreshToken')?.value;

          if (!refreshToken) {
            throw new ServerAuthRefreshError(
              buildAuthRefreshFailure({
                message: '로그인이 필요합니다.',
                errorCode: 'MISSING_AUTH_TOKEN',
              })
            );
          }

          // 토큰 갱신 요청
          const refreshResult = await refreshAccessToken(refreshToken);

          if (!refreshResult.tokenInfo) {
            throw new ServerAuthRefreshError(refreshResult.error);
          }
          const newTokenInfo = refreshResult.tokenInfo;

          // 새 토큰을 쿠키에 저장
          // HTTPS인 경우에만 secure: true 설정 (HTTP에서도 작동하도록)
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
          const isSecure = baseUrl.startsWith('https://');
          
          cookieStore.set('accessToken', newTokenInfo.accessToken, {
            httpOnly: true,
            secure: isSecure,
            sameSite: 'lax',
            maxAge: newTokenInfo.expiresIn,
            path: '/',
          });

          if (newTokenInfo.refreshToken) {
            cookieStore.set('refreshToken', newTokenInfo.refreshToken, {
              httpOnly: true,
              secure: isSecure,
              sameSite: 'lax',
              maxAge: 60 * 60 * 24 * 7,
              path: '/',
            });
          }
          
          // 대기 중인 요청들 처리
          processQueue(null, newTokenInfo.accessToken);

          // 원래 요청 재시도
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newTokenInfo.accessToken}`;
          }
          return client(originalRequest);
        } catch (refreshError) {
          // 토큰 갱신 실패: 로그아웃 처리
          processQueue(refreshError, null);
          
          // 쿠키 삭제
          try {
            const cookieStore = await cookies();
            cookieStore.delete('accessToken');
            cookieStore.delete('refreshToken');
          } catch {
            // 쿠키 삭제 실패 무시
          }

          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      return Promise.reject(error);
    }
  );

  return client;
}

/**
 * 서버 사이드에서 사용할 AI API 클라이언트를 생성합니다. (8083 포트)
 * httpOnly 쿠키에서 accessToken을 자동으로 추출하여 Authorization 헤더에 추가합니다.
 * access token 만료 시 자동으로 refresh token으로 갱신합니다.
 */
export async function getServerAiApiClient(): Promise<AxiosInstance> {
  const client = axios.create({
    baseURL: API_CONFIG.AI_BASE_URL,
    timeout: API_CONFIG.TIMEOUT,
  });

  // 공통 인터셉터 설정 (로깅 등)
  setupInterceptors(client, 'Server AI API');

  let isRefreshing = false;
  let failedQueue: Array<{
    resolve: (value: string | null) => void;
    reject: (error?: unknown) => void;
  }> = [];

  const processQueue = (error: unknown, token: string | null = null) => {
    failedQueue.forEach((prom) => {
      if (error) {
        prom.reject(error);
      } else {
        prom.resolve(token);
      }
    });
    failedQueue = [];
  };

  client.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      try {
        const cookieStore = await cookies();
        const accessToken = cookieStore.get('accessToken')?.value;

        if (accessToken) {
          config.headers.Authorization = `Bearer ${accessToken}`;
        }
      } catch {
        // 토큰 추출 실패 시 무시하고 진행
      }

      return config;
    },
    (error) => Promise.reject(error)
  );

  // 응답 인터셉터: 401 에러 시 토큰 갱신
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

      // 401 Unauthorized 에러이고, 아직 재시도하지 않은 요청인 경우
      if (error.response?.status === 401 && !originalRequest._retry) {
        if (isRefreshing) {
          // 이미 토큰 갱신 중이면 대기
          return new Promise<string | null>((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              if (originalRequest.headers && token) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              return client(originalRequest);
            })
            .catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const cookieStore = await cookies();
          const refreshToken = cookieStore.get('refreshToken')?.value;

          if (!refreshToken) {
            throw new ServerAuthRefreshError(
              buildAuthRefreshFailure({
                message: '로그인이 필요합니다.',
                errorCode: 'MISSING_AUTH_TOKEN',
              })
            );
          }

          // 토큰 갱신 요청
          const refreshResult = await refreshAccessToken(refreshToken);

          if (!refreshResult.tokenInfo) {
            throw new ServerAuthRefreshError(refreshResult.error);
          }
          const newTokenInfo = refreshResult.tokenInfo;

          // 새 토큰을 쿠키에 저장
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
          const isSecure = baseUrl.startsWith('https://');

          cookieStore.set('accessToken', newTokenInfo.accessToken, {
            httpOnly: true,
            secure: isSecure,
            sameSite: 'lax',
            maxAge: newTokenInfo.expiresIn,
            path: '/',
          });

          if (newTokenInfo.refreshToken) {
            cookieStore.set('refreshToken', newTokenInfo.refreshToken, {
              httpOnly: true,
              secure: isSecure,
              sameSite: 'lax',
              maxAge: 60 * 60 * 24 * 7,
              path: '/',
            });
          }

          // 대기 중인 요청들 처리
          processQueue(null, newTokenInfo.accessToken);

          // 원래 요청 재시도
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newTokenInfo.accessToken}`;
          }
          return client(originalRequest);
        } catch (refreshError) {
          // 토큰 갱신 실패: 로그아웃 처리
          processQueue(refreshError, null);

          // 쿠키 삭제
          try {
            const cookieStore = await cookies();
            cookieStore.delete('accessToken');
            cookieStore.delete('refreshToken');
          } catch {
            // 쿠키 삭제 실패 무시
          }

          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      return Promise.reject(error);
    }
  );

  return client;
}
