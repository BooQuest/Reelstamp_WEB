import 'server-only';

export class AuthRequestError extends Error {
  response: { status: number; data: { success: false; status: number; errorCode: string; message: string; data: null } };
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'AuthRequestError';
    this.response = { status, data: { success: false, status, errorCode: code, message, data: null } };
  }
}
export function errorStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}
export const unavailableAuth = () => new AuthRequestError(503, 'AUTH_SERVICE_UNAVAILABLE',
  '로그인 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
export const expiredAuth = () => new AuthRequestError(401, 'INVALID_TOKEN',
  '로그인이 만료되었습니다. 다시 로그인해 주세요.');
