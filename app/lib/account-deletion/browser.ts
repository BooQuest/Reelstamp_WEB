'use client';

import type { DeletionErrorCode, DeletionProof, DeletionResult, DeletionStarted } from './types';

const FLOW_KEY = 'reelstamp:account-deletion';
type Flow = {
  purpose: 'account_deletion'; userId: number; transactionId: string; state: string;
  expiresAt: number; phase: 'awaiting' | 'ready' | 'submitted' | 'failed';
  code?: string; errorCode?: DeletionErrorCode;
};
const inFlight = new Map<string, Promise<DeletionResult>>();

function readFlow(): Flow | null {
  const value = sessionStorage.getItem(FLOW_KEY);
  if (!value) return null;
  const flow = JSON.parse(value);
  if (flow?.purpose !== 'account_deletion' || typeof flow.transactionId !== 'string' ||
      typeof flow.state !== 'string' || !Number.isSafeInteger(flow.userId) || !Number.isFinite(flow.expiresAt))
    throw new Error('Invalid deletion context');
  return flow;
}
function writeFlow(flow: Flow) { sessionStorage.setItem(FLOW_KEY, JSON.stringify(flow)); }

export function rememberDeletionConfirmation(userId: number, started: DeletionStarted) {
  // Failure to persist the confirmation must prevent the OAuth redirect.
  writeFlow({ purpose: 'account_deletion', userId, transactionId: started.transactionId,
    state: started.state, expiresAt: Date.now() + 600_000, phase: 'awaiting' });
}

export function acceptDeletionCallback(params: URLSearchParams): boolean {
  try {
    const flow = readFlow();
    if (!flow || params.getAll('state').length !== 1 || params.getAll('code').length !== 1 ||
        flow.expiresAt <= Date.now() || params.get('state') !== flow.state ||
        params.has('error') || !params.get('code')) {
      if (flow) writeFlow({ ...flow, code: undefined, phase: 'failed', errorCode: 'RS-ACC-001' });
      return false;
    }
    // A repeated callback cannot replace a proof or reset a submitted transaction.
    if (flow.phase === 'awaiting') writeFlow({ ...flow, phase: 'ready', code: params.get('code')! });
    return flow.phase !== 'failed';
  } catch { return false; }
}

/** Claim in storage before dispatch, so StrictMode, remounts and reloads cannot
 * replay a mutation. The server additionally binds and consumes the transaction. */
export function resumeDeletion(userId: number, execute: (proof: DeletionProof) => Promise<DeletionResult>):
  Promise<DeletionResult> | null {
  try {
    const flow = readFlow();
    if (!flow) return null;
    if (flow.userId !== userId || flow.expiresAt <= Date.now()) {
      writeFlow({ ...flow, code: undefined, phase: 'failed', errorCode: 'RS-ACC-001' });
      return Promise.resolve({ success: false, errorCode: 'RS-ACC-001' });
    }
    if (inFlight.has(flow.transactionId)) return inFlight.get(flow.transactionId)!;
    if (flow.phase !== 'ready' || !flow.code) return Promise.resolve({ success: false,
      errorCode: flow.phase === 'submitted' ? 'RS-ACC-003' : flow.errorCode ?? 'RS-ACC-001' });
    const proof = { transactionId: flow.transactionId, code: flow.code, state: flow.state };
    writeFlow({ ...flow, phase: 'submitted', code: undefined });
    const pending = Promise.resolve().then(() => execute(proof)).catch((): DeletionResult =>
      ({ success: false, errorCode: 'RS-ACC-003' })).then(result => {
      // Keep a submitted marker on success until local cleanup. Never retry on reload.
      if (!result.success) writeFlow({ ...flow, phase: 'failed', code: undefined, errorCode: result.errorCode });
      return result;
    });
    inFlight.set(flow.transactionId, pending);
    return pending;
  } catch { return Promise.resolve({ success: false, errorCode: 'RS-ACC-001' }); }
}

export function clearDeletionFlow() {
  try { sessionStorage.removeItem(FLOW_KEY); } catch { /* Direct deletion does not require storage. */ }
  inFlight.clear();
}

export function navigateToDeletionProvider(url: string) { window.location.assign(url); }
export function navigateAfterAccountDeletion() { window.location.replace('/login?accountDeleted=1'); }

export function clearDeletedAccountBrowserState() {
  // This origin's session storage contains OAuth, checkout and editor capabilities.
  // Full navigation below also discards in-memory editor and router caches.
  try { sessionStorage.clear(); } catch { /* Cookie deletion already succeeded. */ }
  inFlight.clear();
}
