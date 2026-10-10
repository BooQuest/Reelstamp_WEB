import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import useDraftAutosave from './useDraftAutosave';
import { DEFAULT_CAPTION_STYLE } from '../constants';
import { makeSession, jsonResponse } from '../test/fixtures';
import type { CaptionItem } from '../types';
const caption = (text: string): CaptionItem => ({
  id: 'caption',
  text,
  source: 'USER',
  role: 'OVERLAY',
  zIndex: 0,
  placement: { type: 'CLIP', clipId: 101 },
  style: DEFAULT_CAPTION_STYLE,
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('serializes draft/apply/draft, preserving pending metadata and restored captions', async () => {
  let version = 3;
  const bodies: Record<string, unknown>[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body);
      bodies.push(body);
      expect(body.version).toBe(version);
      return jsonResponse({
        success: true,
        data: makeSession({
          draftVersion: ++version,
          captionItems: body.captionItems,
        }),
      });
    }),
  );
  const inputCaptions = [caption('new')];
  const { result } = renderHook(() =>
    useDraftAutosave({
      cuts: [{ order: 1 }],
      captions: inputCaptions,
      captionsEnabled: true,
      activeCutIndex: 0,
      isRegisteredUser: true,
      sessionId: 10,
      stage: 'capture',
      isExitConfirmOpen: false,
      sessionHydratedRef: { current: true },
    }),
  );
  act(() =>
    result.current.hydrateDraft({
      projectName: 'old name',
      draftVersion: 3,
      lastEditedAt: null,
      activeClipOrder: 1,
      captions: [caption('new')],
      captionsEnabled: true,
    }),
  );
  act(() => result.current.setProjectName('changed name'));
  await act(async () => {
    await result.current.serializeEdit(async (currentVersion) => {
      expect(currentVersion).toBe(4);
      version++;
      return makeSession({
        draftVersion: version,
        captionItems: [caption('restored')],
      });
    });
    // This request can be queued before React has rendered the restored snapshot.
    await result.current.saveDraftNow();
  });
  expect(bodies).toHaveLength(1);
  expect(bodies[0].projectName).toBe('changed name');
  expect(result.current.captionsRef.current[0].text).toBe('restored');
});
it('does not submit an edit if the preceding autosave conflicts', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      jsonResponse({ success: false, message: 'Conflict' }, false),
    ),
  );
  const task = vi.fn();
  const { result } = renderHook(() =>
    useDraftAutosave({
      cuts: [{ order: 1 }],
      captions: [],
      captionsEnabled: true,
      activeCutIndex: 0,
      isRegisteredUser: true,
      sessionId: 10,
      stage: 'capture',
      isExitConfirmOpen: false,
      sessionHydratedRef: { current: true },
    }),
  );
  await act(async () => {
    await expect(result.current.serializeEdit(task)).rejects.toThrow(
      '저장에 실패',
    );
  });
  expect(task).not.toHaveBeenCalled();
});

it('ignores an old session response after the active project changes', async () => {
  let finish!: (session: ReturnType<typeof makeSession>) => void;
  const pending = new Promise<ReturnType<typeof makeSession>>((resolve) => {
    finish = resolve;
  });
  const task = vi.fn(() => pending);
  const { result, rerender } = renderHook(
    ({ sessionId }) =>
      useDraftAutosave({
        cuts: [{ order: 1 }],
        captions: [],
        captionsEnabled: true,
        activeCutIndex: 0,
        isRegisteredUser: false,
        sessionId,
        stage: 'capture',
        isExitConfirmOpen: false,
        sessionHydratedRef: { current: true },
      }),
    { initialProps: { sessionId: 10 } },
  );
  let operation!: Promise<ReturnType<typeof makeSession>>;
  await act(async () => {
    operation = result.current.serializeEdit(task);
  });
  expect(task).toHaveBeenCalledTimes(1);
  rerender({ sessionId: 20 });
  act(() =>
    result.current.hydrateDraft({
      projectName: 'new project',
      draftVersion: 7,
      lastEditedAt: null,
      activeClipOrder: 1,
      captions: [],
      captionsEnabled: true,
    }),
  );
  await act(async () => {
    finish(
      makeSession({ draftVersion: 99, captionItems: [caption('old session')] }),
    );
    await expect(operation).rejects.toMatchObject({ name: 'AbortError' });
  });
  expect(result.current.projectName).toBe('new project');
  expect(result.current.draftSaveStatus).toBe('saved');
  expect(result.current.captionsRef.current).toEqual([]);
});

it('drops queued autosaves after discard starts', async () => {
  let finish!: (response: Response) => void;
  const pending = new Promise<Response>(resolve => { finish = resolve; });
  const fetcher = vi.fn(() => pending);
  vi.stubGlobal('fetch', fetcher);
  const { result } = renderHook(() => useDraftAutosave({
    cuts: [{ order: 1 }], captions: [], captionsEnabled: true, activeCutIndex: 0,
    isRegisteredUser: true, sessionId: 10, stage: 'capture', isExitConfirmOpen: false,
    sessionHydratedRef: { current: true },
  }));
  let second!: Promise<boolean>;
  await act(async () => { void result.current.saveDraftNow(); });
  act(() => {
    second = result.current.saveDraftNow();
    result.current.suspendAutosave();
  });
  await act(async () => {
    finish(jsonResponse({ success: true, data: makeSession({ draftVersion: 1 }) }));
    expect(await second).toBe(false);
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
