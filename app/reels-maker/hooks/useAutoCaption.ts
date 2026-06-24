'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { WebApiResponse } from '@/app/lib/api/auth';
import type {
  AutoCaptionJobResponse,
  ReelsMakerSessionResponse,
} from '../types';

type Params = {
  sessionId: number | null;
  initialJobId: string | null;
  onSessionReloaded: (session: ReelsMakerSessionResponse) => void;
};

const TERMINAL_STATUSES = new Set(['COMPLETED', 'PARTIAL', 'FAILED', 'STALE']);

export default function useAutoCaption({
  sessionId,
  initialJobId,
  onSessionReloaded,
}: Params) {
  const [job, setJob] = useState<AutoCaptionJobResponse | null>(null);
  const [startedJobId, setStartedJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reloadedJobIdsRef = useRef(new Set<string>());
  const jobId = startedJobId ?? initialJobId;

  const reloadSession = useCallback(async () => {
    if (!sessionId) return;
    const response = await fetch(`/api/reels-maker/sessions/${sessionId}`, {
      method: 'GET',
      cache: 'no-store',
    });
    const payload: WebApiResponse<ReelsMakerSessionResponse> = await response.json();
    if (response.ok && payload?.success && payload.data) {
      onSessionReloaded(payload.data);
    }
  }, [onSessionReloaded, sessionId]);

  const start = useCallback(async () => {
    if (!sessionId) return null;
    setError(null);
    const response = await fetch(
      `/api/reels-maker/sessions/${sessionId}/auto-captions`,
      { method: 'POST' }
    );
    const payload: WebApiResponse<AutoCaptionJobResponse> = await response.json();
    if (!response.ok || !payload?.success || !payload.data) {
      const message = payload?.message || '자동자막 생성을 시작하지 못했습니다.';
      setError(message);
      throw new Error(message);
    }
    setJob(payload.data);
    setStartedJobId(payload.data.jobId);
    return payload.data;
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !jobId) return;
    let cancelled = false;
    let timer: number | null = null;

    const poll = async () => {
      try {
        const response = await fetch(
          `/api/reels-maker/sessions/${sessionId}/auto-captions/${encodeURIComponent(jobId)}`,
          { method: 'GET', cache: 'no-store' }
        );
        const payload: WebApiResponse<AutoCaptionJobResponse> = await response.json();
        if (!response.ok || !payload?.success || !payload.data || cancelled) return;
        setJob(payload.data);
        setError(null);
        if (TERMINAL_STATUSES.has(payload.data.status)) {
          if (!reloadedJobIdsRef.current.has(payload.data.jobId)) {
            reloadedJobIdsRef.current.add(payload.data.jobId);
            await reloadSession();
          }
          return;
        }
      } catch {
        if (!cancelled) setError('자동자막 상태를 확인하지 못했습니다.');
      }
      if (!cancelled) timer = window.setTimeout(poll, 2000);
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [jobId, reloadSession, sessionId]);

  return {
    job,
    error,
    isProcessing:
      job?.status === 'PROCESSING' || Boolean(initialJobId && job == null),
    start,
  };
}
