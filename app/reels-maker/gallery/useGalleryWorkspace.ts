'use client';
import { useEffect, useRef, useState } from 'react';
import type {
  CaptionItem,
  ClipInfo,
  MakerCut,
  ReelsMakerSessionResponse,
} from '../types';
import type {
  EditingMedia,
  MediaSource,
  MediaTarget,
  MediaEdit,
  EditorSnapshot,
} from './types';
import { editorRequest } from './api';
import {
  coverCrop,
  floorTenth,
  MAX_CLIP_SECONDS,
  setEditDuration,
} from './geometry';
import { loadVideoMetadataFromUrl } from '../utils/media/metadata';
import useMediaSources from './useMediaSources';
import useEditorHistory from './useEditorHistory';
import { SourceSync, type SaveState } from './sourceSync';
import { sessionPreview } from './sessionPreview';

type Options = {
  session: ReelsMakerSessionResponse | null;
  cuts: MakerCut[];
  clips: Array<ClipInfo | null>;
  captions: CaptionItem[];
  captionsEnabled: boolean;
  activeCutIndex: number;
  onSession: (session: ReelsMakerSessionResponse) => Promise<void>;
  serialize: (
    task: (version: number) => Promise<ReelsMakerSessionResponse>,
  ) => Promise<ReelsMakerSessionResponse>;
  onLocalClips: (clips: Array<ClipInfo | null>) => void;
  onLocalCaptions: (captions: CaptionItem[], enabled: boolean) => void;
};
export default function useGalleryWorkspace(options: Options) {
  const { session, cuts, activeCutIndex } = options;
  const latest = useRef(options);
  latest.current = options;
  const sources = useMediaSources();
  const [editing, setEditing] = useState<EditingMedia | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [selections, setSelections] = useState<EditorSnapshot['clips']>([]);
  const selectionsRef = useRef(selections);
  selectionsRef.current = selections;
  const local = useRef(new Map<string, ClipInfo>());
  const sync = useRef<SourceSync | null>(null);
  const prepareController = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const sessionId = session?.sessionId;
  const initialized = useRef<number | null>(null);
  const syncOptions = () => ({
    sessionId: sessionId!,
    serialize: (
      task: (version: number) => Promise<ReelsMakerSessionResponse>,
    ) => latest.current.serialize(task),
    onSession: (result: ReelsMakerSessionResponse) => {
      void latest.current.onSession(result);
    },
    onState: (state: SaveState, message: string | null) => {
      if (alive.current) {
        setSaveState(state);
        setError(message);
      }
    },
  });
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      prepareController.current?.abort();
      sync.current?.dispose();
    };
  }, []);
  useEffect(() => {
    if (!sessionId) return;
    const current = latest.current.session!;
    const initial = current.clips
      .filter((c) => !c.fixed && (c.revision || !c.objectKey))
      .map((c) => ({ clipId: c.clipId, revisionId: c.revision?.id ?? null }));
    local.current.clear();
    setSelections(initial);
    selectionsRef.current = initial;
    sync.current = new SourceSync(syncOptions());
    sync.current.seed(
      {
        clips: initial,
        captions: latest.current.captions,
        captionsEnabled: latest.current.captionsEnabled,
      },
      current,
    );
    initialized.current = sessionId;
    setSaveState('saved');
    setError(null);
    setEditing(null);
    return () => {
      sync.current?.dispose();
      prepareController.current?.abort();
      initialized.current = null;
    };
    // Session objects change on every autosave; only a different session owns new resources.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);
  const snapshot: EditorSnapshot = {
    clips: selections,
    captions: options.captions,
    captionsEnabled: options.captionsEnabled,
  };
  const signature = JSON.stringify(snapshot);
  useEffect(() => {
    const next = JSON.parse(signature) as EditorSnapshot;
    if (
      initialized.current === sessionId &&
      JSON.stringify(next.clips) === JSON.stringify(selectionsRef.current)
    )
      sync.current?.schedule(next);
  }, [signature, sessionId]);
  useEffect(() => {
    if (saveState === 'saved') return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [saveState]);
  const publish = (next: EditorSnapshot) => {
    selectionsRef.current = next.clips;
    setSelections(next.clips);
    const opts = latest.current;
    const previews = opts.cuts.map((cut, index) => {
      const saved = opts.session?.clips.find((c) => c.order === cut.order);
      const selected = next.clips.find((c) => c.clipId === saved?.clipId);
      if (cut.isFixed || !selected) return opts.clips[index] ?? null;
      if (!selected.revisionId) return null;
      return (
        local.current.get(selected.revisionId) ??
        (opts.session ? sessionPreview(opts.session, selected.clipId) : null)
      );
    });
    opts.onLocalClips(previews);
    opts.onLocalCaptions(next.captions, next.captionsEnabled);
    sync.current?.schedule(next);
  };
  const history = useEditorHistory(snapshot, async (next) => {
    publish(next);
  });
  useEffect(() => {
    history.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);
  useEffect(() => {
    // Commit-after-render runs on the next animation frame; collect after that frame.
    const timer = setTimeout(() => {
      if (busy) return;
      const ids = history.referencedRevisionIds();
      const urls = new Set<string>();
      const keys = new Set<string>();
      if (editing) {
        urls.add(editing.item.url);
        keys.add(editing.item.key);
      }
      for (const [id, clip] of local.current) {
        if (ids.has(id)) {
          urls.add(clip.url);
          if (clip.source) keys.add(clip.source.key);
        } else local.current.delete(id);
      }
      latest.current.clips.forEach((clip) => {
        if (clip) {
          urls.add(clip.url);
          if (clip.source) keys.add(clip.source.key);
        }
      });
      sync.current?.retain(ids, keys);
      sources.retain(urls);
    }, 50);
    return () => clearTimeout(timer);
  });
  const targetFor = (cutIndex: number): MediaTarget | null => {
    const cut = cuts[cutIndex];
    const clip = session?.clips.find((c) => c.order === cut?.order);
    return cut && !cut.isFixed && clip && session
      ? { sessionId: session.sessionId, clipId: clip.clipId, cutIndex }
      : null;
  };
  const validTarget = (target: MediaTarget) =>
    target.sessionId === latest.current.session?.sessionId &&
    targetFor(target.cutIndex)?.clipId === target.clipId;
  const openItem = async (
    source: MediaSource,
    target: MediaTarget,
    signal: AbortSignal,
    savedEdit?: MediaEdit,
  ) => {
    if (!validTarget(target)) return false;
    const cut = cuts[target.cutIndex];
    let width: number, height: number, duration: number;
    if (source.kind === 'video') {
      const metadata = await loadVideoMetadataFromUrl(
        source.url,
        () => {},
        signal,
      );
      ({ width, height, duration } = metadata);
    } else {
      const image = new Image();
      image.src = source.url;
      await image.decode();
      width = image.naturalWidth;
      height = image.naturalHeight;
      duration = MAX_CLIP_SECONDS;
    }
    if (signal.aborted || !alive.current) return false;
    if (
      !Number.isFinite(width + height + duration) ||
      width <= 0 ||
      height <= 0 ||
      duration < 0.1
    )
      throw new Error('미디어 크기 또는 길이를 확인하지 못했습니다.');
    const seconds = Math.max(
      0.1,
      Math.min(
        floorTenth(duration),
        MAX_CLIP_SECONDS,
        Math.round((cut.durationSeconds || 3) * 10) / 10,
      ),
    );
    const edit = savedEdit
      ? {
          ...savedEdit,
          duration: Math.max(
            0.1,
            Math.min(
              floorTenth(duration),
              MAX_CLIP_SECONDS,
              Math.round(savedEdit.duration * 10) / 10,
            ),
          ),
        }
      : { start: 0, duration: seconds, crop: coverCrop(width, height) };
    edit.start = Math.max(
      0,
      Math.min(floorTenth(duration - edit.duration), edit.start),
    );
    // Legacy results can have a different aspect ratio: start from the visible center crop.
    if (
      Math.abs(
        (edit.crop.width * width) / (edit.crop.height * height) - 9 / 16,
      ) > 0.002
    )
      edit.crop = coverCrop(width, height);
    sync.current?.prepare(source, {
      width,
      height,
      duration: source.kind === 'video' ? duration : null,
    });
    setEditing({
      item: source,
      clipId: target.clipId,
      cutIndex: target.cutIndex,
      width,
      height,
      sourceDuration: duration,
      edit,
      isRecommended: cut.durationMode === 'RECOMMENDED',
    });
    return true;
  };
  const prepare = async (
    source: MediaSource,
    target: MediaTarget,
    edit?: MediaEdit,
  ) => {
    prepareController.current?.abort();
    const controller = new AbortController();
    prepareController.current = controller;
    setBusy(true);
    setError(null);
    try {
      await openItem(source, target, controller.signal, edit);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(
          e instanceof Error ? e.message : '미디어를 불러오지 못했습니다.',
        );
    } finally {
      if (alive.current && prepareController.current === controller)
        setBusy(false);
    }
  };
  const reedit = async () => {
    const target = targetFor(activeCutIndex);
    if (!target || !session) return;
    const current = latest.current.clips[activeCutIndex];
    if (!current) return;
    if (current.source && current.edit)
      return prepare(current.source, target, current.edit);
    let savedSession = session;
    let saved = session.clips.find((c) => c.clipId === target.clipId)!;
    try {
      if (!saved.revision) {
        setBusy(true);
        const metadata = await loadVideoMetadataFromUrl(current.url, () => {});
        const blob = current.blob ?? (await (await fetch(current.url)).blob());
        savedSession = await options.serialize((version) =>
          editorRequest<ReelsMakerSessionResponse>(
            `/api/reels-maker/sessions/${session.sessionId}/clips/${target.clipId}/revisions/adopt-legacy`,
            {
              version,
              metadata: {
                name: `cut-${saved.order}.video`,
                kind: 'video',
                contentType: current.mimeType,
                duration: metadata.duration,
                width: metadata.width,
                height: metadata.height,
                sizeBytes: blob.size,
              },
            },
          ),
        );
        await options.onSession(savedSession);
        saved = savedSession.clips.find((c) => c.clipId === target.clipId)!;
        const adopted = { ...current, revisionId: saved.revision!.id };
        local.current.set(saved.revision!.id, adopted);
        const next = [
          ...selectionsRef.current.filter((c) => c.clipId !== target.clipId),
          { clipId: target.clipId, revisionId: saved.revision!.id },
        ];
        selectionsRef.current = next;
        setSelections(next);
      }
      const asset = savedSession.mediaAssets?.find(
        (a) => a.id === saved.revision?.assetId,
      );
      if (!asset || !saved.revision)
        throw new Error('저장된 원본을 찾을 수 없습니다.');
      const source = await sources.fromAsset(
        asset,
        new AbortController().signal,
        session.sessionId,
      );
      await prepare(source, target, saved.revision.edit);
    } catch (e) {
      setError(e instanceof Error ? e.message : '원본을 불러오지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };
  return {
    busy,
    error,
    saveState,
    conflict: saveState === 'conflict',
    editing,
    history,
    targetFor,
    clearError: () => setError(null),
    openFile: async (file: File, target: MediaTarget) => {
      if (!validTarget(target) || editing) return;
      await prepare(sources.fromFile(file), target);
    },
    reedit,
    confirm: async (value: MediaEdit) => {
      if (!editing || !session) return;
      const startedAt = performance.now();
      const media = editing;
      const edit = setEditDuration(
        value,
        value.duration,
        media.item.kind === 'image'
          ? MAX_CLIP_SECONDS
          : floorTenth(media.sourceDuration),
      );
      history.begin();
      const previous = latest.current.clips[media.cutIndex];
      const saved = session.clips.find((c) => c.clipId === media.clipId);
      if (previous && saved?.revision && !local.current.has(saved.revision.id))
        local.current.set(saved.revision.id, previous);
      const id = crypto.randomUUID();
      local.current.set(id, {
        url: media.item.url,
        blob: media.item.file,
        mimeType: media.item.file?.type || media.item.asset?.contentType || '',
        duration: edit.duration,
        kind: media.item.kind,
        edit,
        revisionId: id,
        source: media.item,
      });
      sync.current?.register({
        id,
        clipId: media.clipId,
        source: media.item,
        edit,
      });
      publish({
        ...snapshot,
        clips: [
          ...selectionsRef.current.filter((c) => c.clipId !== media.clipId),
          { clipId: media.clipId, revisionId: id },
        ],
      });
      setEditing(null);
      history.commitAfterRender();
      requestAnimationFrame(() => {
        if (alive.current)
          console.info('[ReelsMakerTiming]', {
            phase: 'edit-confirm-to-next-frame',
            elapsedMs: Math.round(performance.now() - startedAt),
          });
      });
    },
    canCancel: true,
    cancelEdit: () => {
      prepareController.current?.abort();
      setEditing(null);
      setBusy(false);
    },
    undo: () => history.move(-1),
    redo: () => history.move(1),
    suspend: async () => {
      prepareController.current?.abort();
      await sync.current?.pause();
    },
    resume: () => sync.current?.resume(),
    flush: async () => {
      sync.current?.schedule({
        clips: selectionsRef.current,
        captions: latest.current.captions,
        captionsEnabled: latest.current.captionsEnabled,
      });
      return sync.current?.flush() ?? null;
    },
    retry: async () => {
      await sync.current?.flush();
    },
  };
}
