import {
  applyEditorState,
  editorRequest,
  EditorConflict,
  uploadOriginal,
} from './api';
import type { ReelsMakerSessionResponse } from '../types';
import type {
  EditorSnapshot,
  MediaAsset,
  MediaEdit,
  MediaSource,
} from './types';

export type SaveState = 'saved' | 'uploading' | 'saving' | 'error' | 'conflict';
export type LocalRevision = {
  id: string;
  clipId: number;
  source: MediaSource;
  edit: MediaEdit;
};
type Original = {
  controller: AbortController;
  source: MediaSource;
  metadata: { width: number; height: number; duration: number | null };
  asset?: MediaAsset;
  pending?: Promise<MediaAsset>;
};
type Options = {
  sessionId: number;
  serialize: (
    task: (version: number) => Promise<ReelsMakerSessionResponse>,
  ) => Promise<ReelsMakerSessionResponse>;
  onSession: (session: ReelsMakerSessionResponse) => void;
  onState: (state: SaveState, error: string | null) => void;
};

/** One owner for original uploads and latest-state persistence. Never publishes media to the UI. */
export class SourceSync {
  private controller = new AbortController();
  private uploadedAssets = new Map<string, MediaAsset>();
  private originals = new Map<string, Original>();
  private revisions = new Map<string, LocalRevision>();
  private registered = new Set<string>();
  private uploadQueue: Promise<unknown> = Promise.resolve();
  private latest: EditorSnapshot | null = null;
  private savedSignature = '';
  private running: Promise<void> | null = null;
  private scheduled: ReturnType<typeof setTimeout> | null = null;
  private conflict = false;
  private lastSession: ReelsMakerSessionResponse | null = null;
  constructor(private options: Options) {}
  get disposed() {
    return this.controller.signal.aborted;
  }
  dispose() {
    if (this.scheduled) clearTimeout(this.scheduled);
    this.controller.abort();
  }
  seed(snapshot: EditorSnapshot, session: ReelsMakerSessionResponse) {
    this.savedSignature = JSON.stringify(snapshot);
    this.lastSession = session;
  }
  prepare(source: MediaSource, metadata: Original['metadata']) {
    if (!this.originals.has(source.key))
      this.originals.set(source.key, {
        controller: new AbortController(),
        source,
        metadata,
        asset: source.asset ?? this.uploadedAssets.get(source.key),
      });
    void this.ensureOriginal(source.key)
      .then(() => {
        if (
          !this.disposed &&
          (!this.latest || JSON.stringify(this.latest) === this.savedSignature)
        )
          this.options.onState('saved', null);
      })
      .catch((error) => {
        if (
          !this.disposed &&
          !(error instanceof DOMException && error.name === 'AbortError')
        )
          this.options.onState(
            'error',
            error instanceof Error
              ? error.message
              : '원본 업로드에 실패했습니다.',
          );
      });
  }
  retain(ids: Set<string>, sourceKeys: Set<string>) {
    for (const [id, revision] of this.revisions) {
      if (ids.has(id)) sourceKeys.add(revision.source.key);
      else {
        this.revisions.delete(id);
        this.registered.delete(id);
      }
    }
    for (const [key, item] of this.originals)
      if (!sourceKeys.has(key)) {
        item.controller.abort();
        this.originals.delete(key);
      }
  }
  register(revision: LocalRevision) {
    this.revisions.set(revision.id, revision);
  }
  private ensureOriginal(key: string): Promise<MediaAsset> {
    const item = this.originals.get(key);
    if (!item)
      return Promise.reject(new Error('편집 원본을 찾을 수 없습니다.'));
    if (item.asset) return Promise.resolve(item.asset);
    if (item.pending) return item.pending;
    const pending = this.uploadQueue
      .catch(() => {})
      .then(async () => {
        if (this.disposed || item.controller.signal.aborted)
          throw new DOMException('Cancelled', 'AbortError');
        if (!item.source.file)
          throw new Error('원본 파일을 다시 선택해 주세요.');
        this.options.onState('uploading', null);
        const asset = await uploadOriginal(
          this.options.sessionId,
          item.source.file,
          item.metadata,
          AbortSignal.any([this.controller.signal, item.controller.signal]),
        );
        this.uploadedAssets.set(key, asset);
        item.asset = asset;
        item.source.asset = asset;
        return asset;
      });
    item.pending = pending;
    this.uploadQueue = pending.catch(() => {});
    void pending
      .finally(() => {
        item.pending = undefined;
      })
      .catch(() => {});
    return pending;
  }
  schedule(snapshot: EditorSnapshot) {
    if (JSON.stringify(snapshot) === JSON.stringify(this.latest)) return;
    this.latest = structuredClone(snapshot);
    if (
      JSON.stringify(snapshot) === this.savedSignature ||
      this.conflict ||
      this.disposed
    )
      return;
    const waitingForOriginal = snapshot.clips.some((selection) => {
      const revision = selection.revisionId
        ? this.revisions.get(selection.revisionId)
        : null;
      return revision && !this.originals.get(revision.source.key)?.asset;
    });
    this.options.onState(waitingForOriginal ? 'uploading' : 'saving', null);
    if (this.scheduled) clearTimeout(this.scheduled);
    // Dragging a caption can update at display frequency; persist the settled/latest state.
    if (!this.running)
      this.scheduled = setTimeout(() => {
        void this.flush().catch(() => {});
      }, 150);
  }
  async flush(): Promise<ReelsMakerSessionResponse | null> {
    if (this.scheduled) {
      clearTimeout(this.scheduled);
      this.scheduled = null;
    }
    if (this.conflict)
      throw new EditorConflict(
        '다른 작업에서 프로젝트가 변경되었습니다. 새로고침해 주세요.',
      );
    if (this.disposed) throw new DOMException('Cancelled', 'AbortError');
    if (!this.running) {
      this.running = this.drain()
        .catch((error) => {
          if (error instanceof EditorConflict) this.conflict = true;
          if (!this.disposed)
            this.options.onState(
              this.conflict ? 'conflict' : 'error',
              error instanceof Error ? error.message : '저장에 실패했습니다.',
            );
          throw error;
        })
        .finally(() => {
          this.running = null;
        });
    }
    await this.running;
    return this.lastSession;
  }
  private async drain() {
    while (this.latest && JSON.stringify(this.latest) !== this.savedSignature) {
      const snapshot = this.latest;
      try {
        for (const selection of snapshot.clips) {
          const revision = selection.revisionId
            ? this.revisions.get(selection.revisionId)
            : undefined;
          if (!revision || this.registered.has(revision.id)) continue;
          const asset = await this.ensureOriginal(revision.source.key);
          // An upload may finish after replacement/undo. Persist only the newest selection.
          if (snapshot !== this.latest) break;
          await editorRequest(
            `/api/reels-maker/sessions/${this.options.sessionId}/clips/${revision.clipId}/revisions`,
            { id: revision.id, assetId: asset.id, edit: revision.edit },
            'POST',
            this.controller.signal,
          );
          this.registered.add(revision.id);
        }
        if (snapshot !== this.latest) continue;
        this.options.onState('saving', null);
        const result = await this.options.serialize((version) => {
          if (this.disposed) throw new DOMException('Cancelled', 'AbortError');
          return applyEditorState(
            this.options.sessionId,
            version,
            snapshot,
            this.controller.signal,
          );
        });
        if (this.disposed) return;
        this.lastSession = result;
        this.savedSignature = JSON.stringify(snapshot);
        this.options.onSession(result);
      } catch (error) {
        if (
          snapshot !== this.latest &&
          !(error instanceof EditorConflict) &&
          !this.disposed
        )
          continue;
        throw error;
      }
    }
    if (!this.disposed) this.options.onState('saved', null);
  }
}
