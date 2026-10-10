'use client';

import { useState } from 'react';
import type useGalleryWorkspace from '../gallery/useGalleryWorkspace';
import {
  makerFetch, finishEditorSession, stopEditorRequests, resumeEditorRequests,
} from '../services/editSession';
import { getErrorMessage } from '../utils/errors';

type Options = {
  sessionId: number | null;
  isGuestUser: boolean;
  destination: string;
  navigate: (href: string) => void;
  close: () => void;
  workspace: Pick<ReturnType<typeof useGalleryWorkspace>, 'flush' | 'suspend' | 'resume'>;
  cancelScheduledSave: () => void;
  saveDraftNow: () => Promise<boolean>;
  getDraftVersion: () => number;
  suspendAutosave: () => void;
  resumeAutosave: () => void;
  waitForSaves: () => Promise<boolean>;
};

/** One exit boundary for metadata, media writes, and the server-owned restore point. */
export default function useProjectExit(options: Options) {
  const [isSaving, setIsSaving] = useState(false);
  const { sessionId, workspace, suspendAutosave, resumeAutosave } = options;
  const resume = () => {
    if (sessionId) resumeEditorRequests(sessionId);
    resumeAutosave();
    workspace.resume();
  };
  const save = async () => {
    if (!sessionId || isSaving) return;
    setIsSaving(true);
    try {
      options.cancelScheduledSave();
      if (options.isGuestUser) {
        const response = await makerFetch(`/api/reels-maker/sessions/${sessionId}/abandon`, { method: 'POST' });
        if (!response.ok) throw new Error('프로젝트를 삭제하지 못했습니다. 다시 시도해 주세요.');
      } else {
        resume();
        await workspace.flush();
        if (!(await options.saveDraftNow())) throw new Error('작업을 저장하지 못했습니다. 다시 시도해 주세요.');
        await finishEditorSession(sessionId, 'save', options.getDraftVersion());
        suspendAutosave();
        await workspace.suspend();
      }
      options.close();
      options.navigate(options.destination);
    } catch (error) {
      alert(getErrorMessage(error, '작업을 저장하지 못했습니다. 다시 시도해 주세요.'));
    } finally { setIsSaving(false); }
  };
  const discard = async () => {
    if (!sessionId || isSaving) return;
    setIsSaving(true);
    suspendAutosave();
    stopEditorRequests(sessionId);
    try {
      await Promise.all([workspace.suspend(), options.waitForSaves()]);
      // In-flight saves can increment the version. Restore still validates it under a DB lock.
      const response = await makerFetch(`/api/reels-maker/sessions/${sessionId}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error('프로젝트 상태를 확인하지 못했습니다.');
      await finishEditorSession(sessionId, 'discard', payload.data.draftVersion);
      options.close();
      options.navigate(options.destination);
    } catch (error) {
      alert(getErrorMessage(error, '변경사항을 폐기하지 못했습니다. 다시 시도해 주세요.'));
    } finally { setIsSaving(false); }
  };
  return { isSaving, save, discard, continueEditing: () => { resume(); options.close(); } };
}
