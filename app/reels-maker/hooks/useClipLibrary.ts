'use client';

import { authFetch } from '@/app/lib/auth/browser-session';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClipInfo, ClipSource, MakerCut, PreparedClip, ReelsMakerSessionResponse } from '../types';
import { uploadClip } from '../services/clipUpload';
import { downloadFixedClip } from '../services/fixedClip';
import { createPosterFromClip, revokeBlobUrl } from '../utils/media/previews';
import { getErrorMessage } from '../utils/errors';
import { findNextIncompleteCaptureCutIndex } from '../utils/captureProgression';

type Options = {
  cuts: MakerCut[];
  sessionId: number | null;
  sessionClipMap: Record<number, number>;
};

const withoutIndex = <T,>(entries: Record<number, T>, index: number) => {
  const next = { ...entries };
  delete next[index];
  return next;
};

export default function useClipLibrary({ cuts, sessionId, sessionClipMap }: Options) {
  const [clips, setClips] = useState<Array<ClipInfo | null>>([]);
  const [clipSources, setClipSources] = useState<Record<number, ClipSource>>({});
  const [clipPosters, setClipPosters] = useState<Record<number, string>>({});
  const [uploadedCuts, setUploadedCuts] = useState<Record<number, boolean>>({});
  const [uploadingCuts, setUploadingCuts] = useState<Record<number, boolean>>({});
  const [clipUploadErrors, setClipUploadErrors] = useState<Record<number, string>>({});
  const [fixedClipErrors, setFixedClipErrors] = useState<Record<number, string>>({});
  const [fixedRevision, setFixedRevision] = useState(0);
  const clipsRef = useRef<Array<ClipInfo | null>>([]);
  const uploadedRef = useRef<Record<number, boolean>>({});
  const generationRef = useRef(0);
  const initializedCutsRef = useRef<MakerCut[] | null>(null);
  const hydrationRef = useRef<AbortController | null>(null);
  const uploadsRef = useRef(new Map<number, AbortController>());

  const replaceClips = useCallback((next: Array<ClipInfo | null>) => {
    clipsRef.current.forEach((clip, index) => {
      if (clip?.url && clip.url !== next[index]?.url) revokeBlobUrl(clip.url);
    });
    clipsRef.current = next;
    setClips(next);
  }, []);

  const updateUploaded = useCallback((next: Record<number, boolean>) => {
    uploadedRef.current = next;
    setUploadedCuts(next);
  }, []);

  const cancelUploads = useCallback(() => {
    uploadsRef.current.forEach((controller) => controller.abort());
    uploadsRef.current.clear();
  }, []);

  useEffect(() => () => {
    generationRef.current += 1;
    hydrationRef.current?.abort();
    cancelUploads();
    clipsRef.current.forEach((clip) => revokeBlobUrl(clip?.url ?? null));
    clipsRef.current = [];
  }, [cancelUploads]);

  useEffect(() => () => cancelUploads(), [sessionId, cancelUploads]);

  const reset = useCallback((nextCuts: MakerCut[], preserveFixed = false) => {
    generationRef.current += 1;
    hydrationRef.current?.abort();
    initializedCutsRef.current = nextCuts;
    cancelUploads();
    replaceClips(nextCuts.map((cut, index) =>
      preserveFixed && cut.isFixed ? clipsRef.current[index] ?? null : null
    ));
    updateUploaded(Object.fromEntries(nextCuts.map((cut, index) => [index, cut.isFixed])));
    setUploadingCuts({});
    setClipUploadErrors({});
    setFixedClipErrors({});
    setClipSources({});
    setClipPosters((previous) => preserveFixed
      ? Object.fromEntries(Object.entries(previous).filter(([index]) => nextCuts[Number(index)]?.isFixed))
      : {}
    );
    setFixedRevision((revision) => revision + 1);
  }, [cancelUploads, replaceClips, updateUploaded]);

  const resetCut = useCallback((index: number) => {
    uploadsRef.current.get(index)?.abort();
    uploadsRef.current.delete(index);
    const next = [...clipsRef.current];
    next[index] = null;
    replaceClips(next);
    setClipPosters((previous) => withoutIndex(previous, index));
    setClipSources((previous) => withoutIndex(previous, index));
    setClipUploadErrors((previous) => withoutIndex(previous, index));
    setFixedClipErrors((previous) => withoutIndex(previous, index));
    if (cuts[index]?.isFixed) {
      setFixedRevision((revision) => revision + 1);
    } else {
      updateUploaded({ ...uploadedRef.current, [index]: false });
      setUploadingCuts((previous) => ({ ...previous, [index]: false }));
    }
  }, [cuts, replaceClips, updateUploaded]);

  useEffect(() => {
    if (initializedCutsRef.current !== cuts) return;
    let cancelled = false;
    const controller = new AbortController();
    const generation = generationRef.current;
    const isCurrent = () => !cancelled && generation === generationRef.current;
    const load = async () => {
      for (let index = 0; index < cuts.length; index += 1) {
        const cut = cuts[index];
        if (!cut.isFixed || clipsRef.current[index]) continue;
        if (!cut.fixedVideoUrl) {
          setFixedClipErrors((previous) => ({ ...previous, [index]: '고정 영상 URL이 없습니다.' }));
          continue;
        }
        try {
          const clip = await downloadFixedClip(cut.fixedVideoUrl, cut.durationSeconds, controller.signal);
          if (!isCurrent()) { revokeBlobUrl(clip.url); return; }
          const next = [...clipsRef.current];
          next[index] = clip;
          replaceClips(next);
          try {
            const poster = await createPosterFromClip(clip, controller.signal);
            if (isCurrent()) setClipPosters((previous) => ({ ...previous, [index]: poster }));
          } catch { /* A poster failure must not discard a playable fixed clip. */ }
          if (!isCurrent()) return;
          setFixedClipErrors((previous) => withoutIndex(previous, index));
        } catch (error) {
          if (!isCurrent()) return;
          setFixedClipErrors((previous) => ({ ...previous, [index]: getErrorMessage(error, '고정 영상을 불러오지 못했습니다.') }));
        }
      }
    };
    void load();
    return () => { cancelled = true; controller.abort(); };
  }, [cuts, fixedRevision, replaceClips]);

  const hydrate = useCallback(async (session: ReelsMakerSessionResponse, restoreMedia: boolean) => {
    hydrationRef.current?.abort();
    const controller = new AbortController();
    hydrationRef.current = controller;
    const generation = generationRef.current;
    const restored: Array<ClipInfo | null> = Array(cuts.length).fill(null);
    const createdUrls: string[] = [];
    const uploaded: Record<number, boolean> = {};
    await Promise.all((session.clips ?? []).map(async (clip) => {
      const index = cuts.findIndex((cut) => cut.order === clip.order);
      if (index < 0) return;
      const cut = cuts[index];
      uploaded[index] = cut.isFixed || clip.status === 'UPLOADED';
      if (!restoreMedia || session.status !== 'CAPTURE' || cut.isFixed || clip.status !== 'UPLOADED' || !clip.downloadUrl) return;
      const existing = clipsRef.current[index];
      if (existing?.objectKey && existing.objectKey === clip.objectKey) { restored[index] = existing; return; }
      try {
        const response = await authFetch(`/api/reels-maker/download?url=${encodeURIComponent(clip.downloadUrl)}`, { method: 'GET', cache: 'no-store', signal: controller.signal });
        if (!response.ok) return;
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        createdUrls.push(url);
        restored[index] = {
          blob,
          objectKey: clip.objectKey,
          url,
          mimeType: clip.contentType || blob.type || 'video/webm',
          duration: clip.actualDurationSeconds ?? clip.durationSeconds ?? 0,
        };
      } catch { /* Preserve the server upload status even if the preview cannot load. */ }
    }));
    if (controller.signal.aborted || generation !== generationRef.current) {
      createdUrls.forEach(revokeBlobUrl);
      return false;
    }
    updateUploaded(uploaded);
    setClipSources({});
    if (restoreMedia) {
      // Fixed clips load independently; restoring uploads must not discard them.
      replaceClips(restored.map((clip, index) => cuts[index]?.isFixed ? clipsRef.current[index] ?? null : clip));
    }
    return true;
  }, [cuts, replaceClips, updateUploaded]);

  const reportUploadError = useCallback((index: number, message: string) => {
    setClipUploadErrors((previous) => ({ ...previous, [index]: message }));
  }, []);

  const save = useCallback(async (index: number, clip: PreparedClip, source: ClipSource) => {
    if (!sessionId) throw new Error('릴스 제작 세션이 준비되지 않았습니다.');
    const clipId = sessionClipMap[cuts[index]?.order ?? index + 1];
    if (!clipId) throw new Error('업로드할 클립 정보가 없습니다.');
    if (uploadsRef.current.has(index)) throw new Error('영상 업로드가 진행 중입니다.');
    const controller = new AbortController();
    uploadsRef.current.set(index, controller);
    const previousUploaded = uploadedRef.current[index] ?? false;
    const generation = generationRef.current;
    const assertCurrent = () => {
      if (controller.signal.aborted || generation !== generationRef.current) {
        throw new DOMException('Clip operation cancelled', 'AbortError');
      }
    };
    let poster: string | null = null;
    try {
      try { poster = await createPosterFromClip({ ...clip, url: '' }, controller.signal); } catch { /* optional preview */ }
      assertCurrent();
      setUploadingCuts((previous) => ({ ...previous, [index]: true }));
      updateUploaded({ ...uploadedRef.current, [index]: false });
      setClipUploadErrors((previous) => withoutIndex(previous, index));
      const session = await uploadClip({ sessionId, clipId, clip, signal: controller.signal });
      assertCurrent();
      updateUploaded({ ...uploadedRef.current, [index]: true });
      const next = [...clipsRef.current];
      next[index] = { ...clip, url: URL.createObjectURL(clip.blob) };
      replaceClips(next);
      setClipPosters((previous) => {
        const next = { ...previous };
        if (poster) next[index] = poster; else delete next[index];
        return next;
      });
      setClipSources((previous) => ({ ...previous, [index]: source }));
      return {
        session,
        clipId,
        nextCutIndex: findNextIncompleteCaptureCutIndex({ cuts, uploadedCuts: uploadedRef.current, fromIndex: index, completedCutIndex: index }),
      };
    } catch (error) {
      assertCurrent();
      if (previousUploaded) updateUploaded({ ...uploadedRef.current, [index]: true });
      throw error;
    } finally {
      if (uploadsRef.current.get(index) === controller) {
        uploadsRef.current.delete(index);
        setUploadingCuts((previous) => ({ ...previous, [index]: false }));
      }
    }
  }, [cuts, sessionId, sessionClipMap, replaceClips, updateUploaded]);

  return {
    clips, clipSources, clipPosters, uploadedCuts, uploadingCuts, clipUploadErrors,
    fixedClipErrors, save, hydrate, reset, resetCut, retryFixedClip: resetCut, reportUploadError
  };
}
