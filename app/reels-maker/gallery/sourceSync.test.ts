import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SourceSync } from './sourceSync';
import {
  applyEditorState,
  editorRequest,
  EditorConflict,
  uploadOriginal,
} from './api';
import type { EditorSnapshot, MediaAsset, MediaSource } from './types';
import type { ReelsMakerSessionResponse } from '../types';
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  applyEditorState: vi.fn(),
  editorRequest: vi.fn(),
  uploadOriginal: vi.fn(),
}));
const deferred = <T>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const asset = { id: 'asset' } as MediaAsset;
const session = { sessionId: 1, draftVersion: 1 } as ReelsMakerSessionResponse;
const empty: EditorSnapshot = {
  clips: [{ clipId: 1, revisionId: null }],
  captions: [],
  captionsEnabled: true,
};
const snapshot = (id: string): EditorSnapshot => ({
  ...empty,
  clips: [{ clipId: 1, revisionId: id }],
});
const edit = {
  start: 1,
  duration: 2,
  crop: { x: 0, y: 0, width: 1, height: 1 },
};
function setup() {
  const states = vi.fn();
  const onSession = vi.fn();
  const sync = new SourceSync({
    sessionId: 1,
    serialize: (task) => task(1),
    onState: states,
    onSession,
  });
  sync.seed(empty, session);
  const source: MediaSource = {
    key: 'file',
    name: 'a.mp4',
    kind: 'video',
    url: 'blob:a',
    file: new File(['x'], 'a.mp4'),
  };
  return { sync, source, states, onSession };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(uploadOriginal).mockResolvedValue(asset);
  vi.mocked(editorRequest).mockResolvedValue({});
  vi.mocked(applyEditorState).mockResolvedValue(session);
});
describe('source synchronization', () => {
  it('does not save an obsolete edit when upload finishes after undo', async () => {
    const upload = deferred<MediaAsset>();
    vi.mocked(uploadOriginal).mockReturnValue(upload.promise);
    const { sync, source } = setup();
    sync.prepare(source, { width: 100, height: 100, duration: 5 });
    sync.register({ id: 'first', clipId: 1, source, edit });
    sync.schedule(snapshot('first'));
    sync.schedule(empty);
    upload.resolve(asset);
    await sync.flush();
    expect(applyEditorState).not.toHaveBeenCalled();
    expect(editorRequest).not.toHaveBeenCalled();
    sync.dispose();
  });
  it('coalesces edits while uploading and uploads a reused original only once', async () => {
    const upload = deferred<MediaAsset>();
    vi.mocked(uploadOriginal).mockReturnValue(upload.promise);
    const { sync, source } = setup();
    sync.prepare(source, { width: 100, height: 100, duration: 5 });
    for (const id of ['first', 'latest']) {
      sync.register({ id, clipId: 1, source, edit });
      sync.schedule(snapshot(id));
    }
    upload.resolve(asset);
    await sync.flush();
    expect(editorRequest).toHaveBeenCalledTimes(1);
    expect(vi.mocked(editorRequest).mock.calls[0][1]).toMatchObject({
      id: 'latest',
      assetId: 'asset',
    });
    sync.prepare(source, { width: 100, height: 100, duration: 5 });
    sync.register({ id: 'again', clipId: 1, source, edit });
    sync.schedule(snapshot('again'));
    await sync.flush();
    expect(uploadOriginal).toHaveBeenCalledTimes(1);
    sync.dispose();
  });
  it('serializes a newer selection after an old response without changing its selection', async () => {
    const saved = deferred<ReelsMakerSessionResponse>();
    vi.mocked(applyEditorState).mockReturnValueOnce(saved.promise);
    const { sync, source } = setup();
    source.asset = asset;
    sync.prepare(source, { width: 100, height: 100, duration: 5 });
    sync.register({ id: 'a', clipId: 1, source, edit });
    sync.schedule(snapshot('a'));
    await vi.waitFor(() => expect(applyEditorState).toHaveBeenCalledTimes(1));
    sync.schedule(empty);
    saved.resolve(session);
    await sync.flush();
    expect(vi.mocked(applyEditorState).mock.calls.map((c) => c[2])).toEqual([
      snapshot('a'),
      empty,
    ]);
    sync.dispose();
  });
  it('retries failed uploads but stops writes on a version conflict', async () => {
    vi.mocked(uploadOriginal).mockRejectedValueOnce(new Error('offline'));
    const { sync, source, states } = setup();
    sync.prepare(source, { width: 100, height: 100, duration: 5 });
    sync.register({ id: 'a', clipId: 1, source, edit });
    sync.schedule(snapshot('a'));
    await expect(sync.flush()).rejects.toThrow('offline');
    expect(states).toHaveBeenCalledWith('error', 'offline');
    vi.mocked(applyEditorState).mockRejectedValueOnce(
      new EditorConflict('conflict'),
    );
    await expect(sync.flush()).rejects.toThrow('conflict');
    await expect(sync.flush()).rejects.toBeInstanceOf(EditorConflict);
    expect(applyEditorState).toHaveBeenCalledTimes(1);
    sync.dispose();
  });
  it('limits uploads to one at a time and aborts work no longer referenced', async () => {
    const first = deferred<MediaAsset>();
    vi.mocked(uploadOriginal).mockReturnValueOnce(first.promise);
    const { sync, source } = setup();
    sync.prepare(source, { width: 100, height: 100, duration: 5 });
    const other = { ...source, key: 'other' };
    sync.prepare(other, { width: 100, height: 100, duration: 5 });
    await vi.waitFor(() => expect(uploadOriginal).toHaveBeenCalledTimes(1));
    sync.retain(new Set(), new Set(['file']));
    first.resolve(asset);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(uploadOriginal).toHaveBeenCalledTimes(1);
    sync.dispose();
  });
});

it('does not register or apply revisions after an upload resolves during discard', async () => {
  const upload = deferred<MediaAsset>();
  vi.mocked(uploadOriginal).mockReturnValue(upload.promise);
  const { sync, source, onSession } = setup();
  sync.prepare(source, { width: 100, height: 100, duration: 5 });
  sync.register({ id: 'discarded', clipId: 1, source, edit });
  sync.schedule(snapshot('discarded'));
  const writing = sync.flush();
  const stopping = sync.pause();
  upload.resolve(asset);
  await Promise.allSettled([writing, stopping]);
  expect(editorRequest).not.toHaveBeenCalled();
  expect(applyEditorState).not.toHaveBeenCalled();
  expect(onSession).not.toHaveBeenCalled();
});
