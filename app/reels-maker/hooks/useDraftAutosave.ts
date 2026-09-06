'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import type { WebApiResponse } from '@/app/lib/api/auth';
import type {
  CaptionItem,
  DraftSaveStatus,
  ReelsMakerSessionResponse,
  Stage,
} from '../types';
import {
  buildCaptionExportStyle,
  buildDraftSignature,
  normalizeCaptionText,
} from '../utils/captions';

type CutLike = {
  order: number;
};

type HydrateDraftInput = {
  projectName: string;
  draftVersion: number;
  lastEditedAt: string | null;
  activeClipOrder: number | null;
  captions: CaptionItem[];
  captionsEnabled: boolean;
};

type Params = {
  cuts: CutLike[];
  captions: CaptionItem[];
  captionsEnabled: boolean;
  activeCutIndex: number;
  isRegisteredUser: boolean;
  sessionId: number | null;
  stage: Stage;
  isExitConfirmOpen: boolean;
  sessionHydratedRef: MutableRefObject<boolean>;
};

export default function useDraftAutosave({
  cuts,
  captions,
  captionsEnabled,
  activeCutIndex,
  isRegisteredUser,
  sessionId,
  stage,
  isExitConfirmOpen,
  sessionHydratedRef,
}: Params) {
  const captionsRef = useRef<CaptionItem[]>([]);
  const projectNameRef = useRef('');
  const activeCutIndexRef = useRef(0);
  const captionsEnabledRef = useRef(true);
  const draftVersionRef = useRef(0);
  const draftSaveTimerRef = useRef<number | null>(null);
  const draftSaveQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const lastSavedDraftSignatureRef = useRef<string | null>(null);
  const isExitingWithoutSavingRef = useRef(false);

  const [projectName, setProjectName] = useState('');
  const [draftVersion, setDraftVersion] = useState(0);
  const [draftSaveStatus, setDraftSaveStatus] =
    useState<DraftSaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  useEffect(() => {
    captionsRef.current = captions;
  }, [captions]);

  useEffect(() => {
    projectNameRef.current = projectName;
  }, [projectName]);

  useEffect(() => {
    activeCutIndexRef.current = activeCutIndex;
  }, [activeCutIndex]);

  useEffect(() => {
    captionsEnabledRef.current = captionsEnabled;
  }, [captionsEnabled]);

  useEffect(() => {
    draftVersionRef.current = draftVersion;
  }, [draftVersion]);

  const cancelScheduledSave = useCallback(() => {
    if (draftSaveTimerRef.current !== null) {
      window.clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = null;
    }
  }, []);

  const saveDraftNow = useCallback((): Promise<boolean> => {
    if (!isRegisteredUser || !sessionId || !sessionHydratedRef.current) {
      return Promise.resolve(true);
    }

    const saveTask = draftSaveQueueRef.current
      .catch(() => false)
      .then(async () => {
        const activeOrder =
          cuts[activeCutIndexRef.current]?.order ?? cuts[0]?.order ?? null;
        const captionItems = captionsRef.current
          .map((caption) => ({
            ...caption,
            text: normalizeCaptionText(caption.text),
          }))
          .filter((caption) => caption.text.trim().length > 0)
          .map((caption) => ({
            id: caption.id,
            text: caption.text,
            source: caption.source,
            role: caption.role,
            placement: caption.placement,
            zIndex: caption.zIndex,
            style: buildCaptionExportStyle(caption.style),
          }));
        const signature = buildDraftSignature(
          projectNameRef.current,
          activeOrder,
          captionsRef.current,
          captionsEnabledRef.current
        );
        if (signature === lastSavedDraftSignatureRef.current) {
          setDraftSaveStatus('saved');
          return true;
        }
        setDraftSaveStatus('saving');

        try {
          const response = await fetch(
            `/api/reels-maker/sessions/${sessionId}/draft`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                projectName: projectNameRef.current,
                lastActiveClipOrder: activeOrder,
                version: draftVersionRef.current,
                captionItems,
                captionsEnabled: captionsEnabledRef.current,
              }),
            }
          );
          const payload: WebApiResponse<ReelsMakerSessionResponse> =
            await response.json();
          if (!response.ok || !payload?.success || !payload?.data) {
            throw new Error(payload?.message || '프로젝트 저장에 실패했습니다.');
          }
          const nextVersion =
            payload.data.draftVersion ?? draftVersionRef.current;
          draftVersionRef.current = nextVersion;
          setDraftVersion(nextVersion);
          setLastSavedAt(
            payload.data.lastEditedAt ?? new Date().toISOString()
          );
          lastSavedDraftSignatureRef.current = signature;
          setDraftSaveStatus('saved');
          return true;
        } catch {
          setDraftSaveStatus('error');
          return false;
        }
      });

    draftSaveQueueRef.current = saveTask;
    return saveTask;
  }, [cuts, isRegisteredUser, sessionHydratedRef, sessionId]);

  useEffect(() => {
    if (
      !isRegisteredUser ||
      !sessionId ||
      !sessionHydratedRef.current ||
      isExitConfirmOpen ||
      isExitingWithoutSavingRef.current ||
      (stage !== 'capture' && stage !== 'caption-edit')
    ) {
      return;
    }
    cancelScheduledSave();
    draftSaveTimerRef.current = window.setTimeout(() => {
      draftSaveTimerRef.current = null;
      void saveDraftNow();
    }, 1000);
    return cancelScheduledSave;
  }, [
    activeCutIndex,
    cancelScheduledSave,
    captions,
    captionsEnabled,
    isExitConfirmOpen,
    isRegisteredUser,
    projectName,
    saveDraftNow,
    sessionHydratedRef,
    sessionId,
    stage,
  ]);

  useEffect(() => {
    if (!isRegisteredUser) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (draftSaveStatus !== 'saving' && draftSaveStatus !== 'error') return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [draftSaveStatus, isRegisteredUser]);

  const hydrateDraft = useCallback((input: HydrateDraftInput) => {
    setProjectName(input.projectName);
    projectNameRef.current = input.projectName;
    setDraftVersion(input.draftVersion);
    draftVersionRef.current = input.draftVersion;
    setLastSavedAt(input.lastEditedAt);
    setDraftSaveStatus('saved');
    lastSavedDraftSignatureRef.current = buildDraftSignature(
      input.projectName,
      input.activeClipOrder,
      input.captions,
      input.captionsEnabled
    );
  }, []);

  const resetDraft = useCallback(() => {
    cancelScheduledSave();
    setProjectName('');
    projectNameRef.current = '';
    setDraftVersion(0);
    draftVersionRef.current = 0;
    setDraftSaveStatus('idle');
    setLastSavedAt(null);
    lastSavedDraftSignatureRef.current = null;
    isExitingWithoutSavingRef.current = false;
  }, [cancelScheduledSave]);

  const applyServerUpdate = useCallback(
    (session: ReelsMakerSessionResponse) => {
      const nextVersion = session.draftVersion ?? draftVersionRef.current;
      draftVersionRef.current = nextVersion;
      setDraftVersion(nextVersion);
      setLastSavedAt(session.lastEditedAt ?? new Date().toISOString());
      if (isRegisteredUser) {
        setDraftSaveStatus('saved');
      }
    },
    [isRegisteredUser]
  );

  const resumeAutosave = useCallback(() => {
    isExitingWithoutSavingRef.current = false;
  }, []);

  const suspendAutosave = useCallback(() => {
    isExitingWithoutSavingRef.current = true;
    cancelScheduledSave();
  }, [cancelScheduledSave]);

  return {
    projectName,
    setProjectName,
    draftSaveStatus,
    lastSavedAt,
    captionsRef,
    saveDraftNow,
    hydrateDraft,
    resetDraft,
    applyServerUpdate,
    cancelScheduledSave,
    resumeAutosave,
    suspendAutosave,
  };
}
