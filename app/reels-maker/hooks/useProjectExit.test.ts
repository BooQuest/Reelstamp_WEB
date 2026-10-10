import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { authFetch } from '@/app/lib/auth/browser-session';
import useProjectExit from './useProjectExit';
import { releaseEditorSession } from '../services/editSession';
import { deferred, jsonResponse } from '../test/fixtures';

vi.mock('@/app/lib/auth/browser-session', () => ({ authFetch: vi.fn() }));
const fetcher = vi.mocked(authFetch);
beforeEach(() => {
  fetcher.mockImplementation(async path => typeof path === 'string' && path.endsWith('/10')
    ? jsonResponse({ success: true, data: { draftVersion: 8 } })
    : jsonResponse({ success: true, data: { outcome: 'DISCARDED' } }));
  vi.stubGlobal('alert', vi.fn());
});
afterEach(() => { cleanup(); releaseEditorSession(10); vi.clearAllMocks(); vi.unstubAllGlobals(); });
function options() {
  return {
    sessionId: 10, isGuestUser: false, destination: '/my-projects', navigate: vi.fn(), close: vi.fn(),
    workspace: { flush: vi.fn().mockResolvedValue(null), suspend: vi.fn().mockResolvedValue(undefined), resume: vi.fn() },
    cancelScheduledSave: vi.fn(), saveDraftNow: vi.fn().mockResolvedValue(true), getDraftVersion: () => 7,
    suspendAutosave: vi.fn(), resumeAutosave: vi.fn(), waitForSaves: vi.fn().mockResolvedValue(true),
  };
}
it('waits for in-flight writes and confirmed discard before navigating', async () => {
  const queued = deferred<boolean>();
  const input = options(); input.waitForSaves.mockReturnValue(queued.promise);
  const { result } = renderHook(() => useProjectExit(input));
  let task!: Promise<void>;
  await act(async () => { task = result.current.discard(); });
  expect(input.suspendAutosave).toHaveBeenCalled();
  expect(fetcher).not.toHaveBeenCalled();
  expect(input.navigate).not.toHaveBeenCalled();
  await act(async () => { queued.resolve(true); await task; });
  expect(JSON.parse(fetcher.mock.calls[1][1]?.body as string)).toEqual({ version: 8 });
  expect(fetcher.mock.calls[1][0]).toBe('/api/reels-maker/sessions/10/edit/discard');
  expect(input.navigate).toHaveBeenCalledWith('/my-projects');
});
it('keeps the editor open when the server cannot confirm discard', async () => {
  fetcher.mockResolvedValueOnce(jsonResponse({ success: false }, false));
  const input = options();
  const { result } = renderHook(() => useProjectExit(input));
  await act(() => result.current.discard());
  expect(input.navigate).not.toHaveBeenCalled();
  expect(input.close).not.toHaveBeenCalled();
  expect(alert).toHaveBeenCalled();
  act(() => result.current.continueEditing());
  expect(input.resumeAutosave).toHaveBeenCalled();
  expect(input.workspace.resume).toHaveBeenCalled();
});
it('does not claim save-and-exit succeeded when the draft save fails', async () => {
  const input = options(); input.saveDraftNow.mockResolvedValue(false);
  const { result } = renderHook(() => useProjectExit(input));
  await act(() => result.current.save());
  expect(input.workspace.flush).toHaveBeenCalled();
  expect(input.navigate).not.toHaveBeenCalled();
  expect(fetcher).not.toHaveBeenCalled();
  expect(alert).toHaveBeenCalled();
});
it('commits only after all media and metadata saves complete', async () => {
  const input = options(); const pending = deferred<null>(); input.workspace.flush.mockReturnValue(pending.promise);
  const { result } = renderHook(() => useProjectExit(input));
  let task!: Promise<void>;
  await act(async () => { task = result.current.save(); });
  expect(fetcher).not.toHaveBeenCalled();
  await act(async () => { pending.resolve(null); await task; });
  expect(fetcher.mock.calls[0][0]).toBe('/api/reels-maker/sessions/10/edit/save');
  expect(input.navigate).toHaveBeenCalledWith('/my-projects');
});
