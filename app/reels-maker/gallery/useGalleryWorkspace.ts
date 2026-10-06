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
import {
  applyEditorState,
  editorRequest,
  EditorConflict,
  uploadOriginal,
  uploadRevision,
} from './api';
import { coverCrop, floorTenth } from './geometry';
import { loadVideoMetadataFromUrl } from '../utils/media/metadata';
import { captureVideoSegmentToBlob } from '../utils/media/videoSegment';
import { imageToVideoBlob } from '../utils/media/imageVideo';
import useMediaSources from './useMediaSources';
import useEditorHistory from './useEditorHistory';

type Options = {
  session: ReelsMakerSessionResponse;
  cuts: MakerCut[];
  clips: Array<ClipInfo | null>;
  captions: CaptionItem[];
  captionsEnabled: boolean;
  activeCutIndex: number;
  onSession: (session: ReelsMakerSessionResponse) => Promise<void>;
  serialize: (
    task: (version: number) => Promise<ReelsMakerSessionResponse>,
  ) => Promise<ReelsMakerSessionResponse>;
  onBusy: (value: boolean) => void;
};
export default function useGalleryWorkspace(options: Options) {
  const { session, cuts, clips, activeCutIndex, onSession, serialize, onBusy } =
    options;
  const sources = useMediaSources();
  const { release } = sources;
  const [editing, setEditing] = useState<EditingMedia | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const running = useRef(false);
  const applying = useRef(false);
  const [applyingState, setApplyingState] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);
  const editingUrl = editing?.item.url;
  useEffect(() => {
    if (editingUrl) return () => release(editingUrl);
  }, [editingUrl, release]);
  const targetFor = (cutIndex: number): MediaTarget | null => {
    const cut = cuts[cutIndex];
    const clip = session.clips.find((c) => c.order === cut?.order);
    return cut && !cut.isFixed && clip
      ? { sessionId: session.sessionId, clipId: clip.clipId, cutIndex }
      : null;
  };
  const validTarget = (target: MediaTarget) => {
    const expected = targetFor(target.cutIndex);
    return (
      expected?.sessionId === target.sessionId &&
      expected.clipId === target.clipId
    );
  };
  useEffect(() => {
    onBusy(busy || conflict);
    return () => onBusy(false);
  }, [busy, conflict, onBusy]);
  useEffect(() => {
    if (!busy) return;
    const prevent = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [busy]);
  const snapshot: EditorSnapshot = {
    clips: session.clips
      .filter((c) => !c.fixed && (c.revision || !c.objectKey))
      .map((c) => ({ clipId: c.clipId, revisionId: c.revision?.id ?? null })),
    captions: options.captions,
    captionsEnabled: options.captionsEnabled,
  };
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const run = async (task: (signal: AbortSignal) => Promise<void>) => {
    if (running.current || conflict) return;
    running.current = true;
    controller.current = new AbortController();
    setBusy(true);
    setError(null);
    try {
      await task(controller.current.signal);
    } catch (e) {
      if (
        !alive.current ||
        (e instanceof DOMException && e.name === 'AbortError')
      )
        return;
      setError(
        e instanceof Error ? e.message : '미디어 편집을 처리하지 못했습니다.',
      );
      if (e instanceof EditorConflict) setConflict(true);
    } finally {
      running.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const apply = async (state: EditorSnapshot) => {
    applying.current = true;
    setApplyingState(true);
    try {
      const result = await serialize((version) => {
        if (!alive.current || controller.current?.signal.aborted)
          throw new DOMException('Cancelled', 'AbortError');
        return applyEditorState(
          session.sessionId,
          version,
          state,
          controller.current?.signal,
        );
      });
      if (alive.current) await onSession(result);
    } finally {
      applying.current = false;
      if (alive.current) setApplyingState(false);
    }
  };
  const history = useEditorHistory(snapshot, apply);
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
      duration = 3600;
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
        3600,
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
    setEditing({
      item: source,
      clipId: target.clipId,
      cutIndex: target.cutIndex,
      width,
      height,
      sourceDuration: duration,
      edit,
      wasForced: cut.durationMode === 'FORCED',
    });
    return true;
  };
  const prepareSource = async (
    source: MediaSource,
    target: MediaTarget,
    signal: AbortSignal,
    edit?: MediaEdit,
  ) => {
    let opened = false;
    try {
      opened = await openItem(source, target, signal, edit);
    } finally {
      if (!opened) sources.release(source.url);
    }
  };
  const ensureLegacy = async (signal: AbortSignal, target: MediaTarget) => {
    const cut = cuts[target.cutIndex];
    if (!cut || cut.isFixed) return session;
    let saved = session.clips.find((c) => c.order === cut.order);
    if (!saved?.objectKey) return session;
    let current = session;
    if (!saved.revision) {
      const clip = clips[target.cutIndex];
      if (!clip) throw new Error('저장된 영상을 먼저 불러와 주세요.');
      const meta = await loadVideoMetadataFromUrl(clip.url, () => {}, signal);
      current = await serialize((version) => {
        if (!alive.current || signal.aborted)
          throw new DOMException('Cancelled', 'AbortError');
        return editorRequest<ReelsMakerSessionResponse>(
          `/api/reels-maker/sessions/${session.sessionId}/clips/${saved!.clipId}/revisions/adopt-legacy`,
          {
            version,
            metadata: {
              name: `cut-${cut.order}.video`,
              kind: 'video',
              contentType: clip.mimeType,
              duration: meta.duration,
              width: meta.width,
              height: meta.height,
              sizeBytes: clip.blob.size,
            },
          },
          'POST',
          signal,
        );
      });
      if (!alive.current || signal.aborted)
        throw new DOMException('Cancelled', 'AbortError');
      await onSession(current);
      saved = current.clips.find((c) => c.order === cut.order);
    }
    return current;
  };
  const reedit = () => {
    const target = targetFor(activeCutIndex);
    if (!target) return;
    return run(async (signal) => {
      const current = await ensureLegacy(signal, target);
      const saved = current.clips.find((c) => c.clipId === target.clipId);
      const asset = current.mediaAssets?.find(
        (a) => a.id === saved?.revision?.assetId,
      );
      if (!asset || !saved?.revision)
        throw new Error('저장된 원본을 찾을 수 없습니다.');
      const source = await sources.fromAsset(asset, signal);
      await prepareSource(source, target, signal, saved.revision.edit);
    });
  };
  const confirm = (edit: MediaEdit) =>
    run(async (signal) => {
      if (!editing?.item.file) return;
      history.begin();
      try {
        const media = editing;
        const prepared =
          media.item.kind === 'image'
            ? await imageToVideoBlob(
                media.item.file!,
                edit.duration,
                () => {},
                signal,
                edit.crop,
              )
            : await captureVideoSegmentToBlob(
                media.item.url,
                {
                  width: media.width,
                  height: media.height,
                  duration: media.sourceDuration,
                },
                edit.start,
                edit.start + edit.duration,
                () => {},
                signal,
                edit.crop,
              );
        let asset = media.item.asset;
        if (!asset) {
          asset = await uploadOriginal(
            session.sessionId,
            media.item.file!,
            {
              width: media.width,
              height: media.height,
              duration:
                media.item.kind === 'video' ? media.sourceDuration : null,
            },
            signal,
          );
          sources.associate(media.item.key, asset);
          setEditing((previous) =>
            previous
              ? { ...previous, item: { ...previous.item, asset } }
              : null,
          );
        }
        const revision = await uploadRevision(
          session.sessionId,
          media.clipId,
          asset.id,
          edit,
          prepared,
          signal,
        );
        const before = snapshotRef.current;
        const state = {
          ...before,
          clips: [
            ...before.clips.filter((c) => c.clipId !== media.clipId),
            { clipId: media.clipId, revisionId: revision.id },
          ],
        };
        await apply(state);
        if (alive.current) {
          setEditing(null);
          history.commitAfterRender();
        }
      } catch (e) {
        history.cancel();
        throw e;
      }
    });
  return {
    busy,
    error,
    conflict,
    editing,
    history,
    targetFor,
    clearError: () => setError(null),
    openFile: (file: File, target: MediaTarget) => {
      if (!validTarget(target) || editing) return Promise.resolve();
      return run(async (signal) => {
        await ensureLegacy(signal, target);
        if (signal.aborted || !alive.current) return;
        await prepareSource(sources.fromFile(file), target, signal);
      });
    },
    reedit,
    confirm,
    canCancel: !applyingState,
    cancelEdit: () => {
      if (!applying.current) {
        controller.current?.abort();
        setEditing(null);
        setError(null);
      }
    },
    undo: () =>
      run(async () => {
        await history.move(-1);
      }),
    redo: () =>
      run(async () => {
        await history.move(1);
      }),
  };
}
