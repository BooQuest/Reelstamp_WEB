export type DeletionErrorCode = 'RS-ACC-001' | 'RS-ACC-002' | 'RS-ACC-003';
export type DeletionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; errorCode: DeletionErrorCode };

export interface DeletionPass {
  type: 'PURCHASE' | 'LEGACY' | 'COUPON';
  productName: string;
  paidAt: string | null;
  expiresAt: string;
  amount: number | null;
}
export interface DeletionPreview { active: DeletionPass[]; scheduled: DeletionPass[] }
export interface DeletionStarted {
  purpose: 'account_deletion';
  transactionId: string;
  authorizationUrl: string;
  state: string;
}
export interface DeletionProof { transactionId: string; state: string; code: string }

export const deletionErrorMessage = (code: DeletionErrorCode) => ({
  'RS-ACC-001': '본인 확인에 실패했습니다. 로그인 상태를 확인한 뒤 다시 시도해 주세요.',
  'RS-ACC-002': '진행 중인 결제가 있습니다. 결제가 완료되거나 취소된 뒤 다시 시도해 주세요.',
  'RS-ACC-003': '일시적인 오류로 탈퇴를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.',
})[code];
