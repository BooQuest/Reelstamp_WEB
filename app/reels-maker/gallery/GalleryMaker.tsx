'use client';
import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react';
import {
  Pencil,
  Play,
  Pause,
  Redo2,
  Repeat,
  Scissors,
  Undo2,
} from 'lucide-react';
import type { ClipInfo, MakerCut, ReelsMakerSessionResponse } from '../types';
import type useCaptionEditor from '../hooks/useCaptionEditor';
import CaptionOverlayStage from '../components/CaptionOverlayStage';
import type useGalleryWorkspace from './useGalleryWorkspace';
import ClipPlayer, { type ClipPlayerHandle } from '../components/ClipPlayer';
import useSingleMediaPicker from './useSingleMediaPicker';
import CutStrip from './CutStrip';
import { createPortal } from 'react-dom';
import MediaEditModal from './MediaEditModal';
import CaptionToolbar from './CaptionToolbar';
import { MAX_CAPTIONS_PER_CLIP } from '../constants';

export type GalleryMakerHandle = { openPicker: (cutIndex: number) => void };

type Props = {
  ref?: Ref<GalleryMakerHandle>;
  workspace: ReturnType<typeof useGalleryWorkspace>;
  session: ReelsMakerSessionResponse;
  cuts: MakerCut[];
  clips: Array<ClipInfo | null>;
  captionsEnabled: boolean;
  activeCutIndex: number;
  onSelectCut: (index: number) => void;
  onGuide: () => void;
  onNext: () => void;
  allDone: boolean;
  header: ReactNode;
  captionEditor: ReturnType<typeof useCaptionEditor>;
  fixedErrors: Record<number, string>;
  onRetryFixed: (index: number) => void;
  paused: boolean;
};
export default function GalleryMaker({ ref, ...props }: Props) {
  const {
    cuts,
    clips,
    activeCutIndex,
    captionsEnabled,
    captionEditor: caption,
    header,
  } = props;
  const workspace = props.workspace;
  const { history } = workspace;
  const historyRef = useRef(history);
  useLayoutEffect(() => {
    historyRef.current = history;
  }, [history]);
  const cut = cuts[activeCutIndex];
  const clip = clips[activeCutIndex];
  const isEmptyCut = (index: number) => !cuts[index]?.isFixed && !clips[index];
  const empty = isEmptyCut(activeCutIndex);
  const {
    inputRef,
    open: openFilePicker,
    onChange: onFileChange,
    error: pickerError,
  } = useSingleMediaPicker(props.session.sessionId, workspace.openFile);
  const video = useRef<ClipPlayerHandle>(null);
  const frame = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playback, setPlayback] = useState({ revision: '', ms: 0 });
  const mediaKey = `${clip?.url}:${clip?.revisionId ?? ''}`;
  const playbackMs = playback.revision === mediaKey ? playback.ms : 0;
  const captionPointers = useRef(new Set<number>());
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionsRef = useRef({ caption, disabled: false });
  const disabled = workspace.busy || Boolean(workspace.editing);
  useLayoutEffect(() => {
    actionsRef.current = { caption, disabled };
  }, [caption, disabled]);
  const pause = () => {
    video.current?.pause();
    setPlaying(false);
  };
  useEffect(() => {
    video.current?.pause();
  }, [activeCutIndex, empty, workspace.editing, props.paused]);
  useEffect(() => {
    if (!playing || !clip) return;
    let frameId = 0;
    const check = () => {
      if (video.current && video.current.currentTime >= clip.duration) {
        video.current.pause();
        return;
      }
      frameId = requestAnimationFrame(check);
    };
    frameId = requestAnimationFrame(check);
    return () => cancelAnimationFrame(frameId);
  }, [playing, clip]);
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      const { caption: current, disabled: blocked } = actionsRef.current;
      if (!event.altKey || !current.resolvedSelectedCaptionId || blocked)
        return;
      const target = event.target as Node;
      if (!current.captionOverlayRef.current?.contains(target)) return;
      event.preventDefault();
      historyRef.current.begin();
      current.handleCaptionScaleChange(
        current.activeCaptionStyle.scale * Math.exp(-event.deltaY * 0.002),
      );
      if (wheelTimer.current) clearTimeout(wheelTimer.current);
      wheelTimer.current = setTimeout(
        () => historyRef.current.commitAfterRender(),
        250,
      );
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => {
      element.removeEventListener('wheel', wheel);
      if (wheelTimer.current) clearTimeout(wheelTimer.current);
    };
  }, []);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      const target = event.target as HTMLElement;
      if (
        target?.closest('input,textarea,select,[contenteditable=true]') ||
        disabled ||
        !caption.resolvedSelectedCaptionId
      )
        return;
      event.preventDefault();
      historyRef.current.begin();
      caption.deleteSelectedCaption();
      historyRef.current.commitAfterRender();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [caption, disabled]);
  const editText = (id: string | null) => {
    if (id) history.begin();
    caption.setEditingCaptionId(id);
    if (!id) history.commitAfterRender();
  };
  const openPicker = (index: number) => {
    if (disabled) return;
    const target = workspace.targetFor(index);
    if (!target) return;
    pause();
    editText(null);
    caption.setSelectedCaptionId(null);
    props.onSelectCut(index);
    workspace.clearError();
    openFilePicker(target);
  };
  useImperativeHandle(ref, () => ({ openPicker }));
  return (
    <div
      inert={Boolean(workspace.editing)}
      className="mx-auto flex h-full min-h-0 w-full max-w-2xl flex-col bg-[#1E2A3B] text-white"
    >
      <div className="flex shrink-0 items-center gap-2 px-3 py-2">
        <div className="min-w-0 flex-1">{header}</div>
        <button
          type="button"
          onClick={() => {
            pause();
            editText(null);
            props.onGuide();
          }}
          disabled={disabled}
          className="rounded-full bg-white/10 px-3 py-2 text-xs"
        >
          가이드
        </button>
        <button
          type="button"
          onClick={() => {
            pause();
            editText(null);
            props.onNext();
          }}
          disabled={!props.allDone || disabled}
          className="rounded-full bg-rose-500 px-4 py-2 text-sm disabled:opacity-40"
        >
          완료
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        aria-label="사진·영상 선택"
        onChange={onFileChange}
      />
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        <div
          ref={(element) => {
            frame.current = element;
            caption.handleCameraFrameRef(element);
          }}
          className="relative aspect-[9/16] max-h-full overflow-hidden bg-black"
          style={{ height: '100%', maxWidth: '100%' }}
        >
          {empty ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
              <p className="text-sm text-white/65">
                이 컷에 사용할 사진 또는 영상을 선택해 주세요.
              </p>
              <button
                type="button"
                disabled={disabled}
                onClick={() => openPicker(activeCutIndex)}
                className="rounded-xl bg-rose-500 px-5 py-3 text-sm font-semibold disabled:opacity-40"
              >
                사진·영상 불러오기
              </button>
            </div>
          ) : clip ? (
            <ClipPlayer
              key={`${clip.url}:${clip.revisionId ?? ''}`}
              ref={video}
              clip={clip}
              onTimeUpdate={(event) =>
                setPlayback({
                  revision: mediaKey,
                  ms: event.currentTarget.currentTime * 1000,
                })
              }
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
            />
          ) : (
            <div className="p-6 text-center text-sm">
              {props.fixedErrors[activeCutIndex] ||
                (cut?.isFixed
                  ? '고정 영상을 불러오는 중입니다…'
                  : '영상을 불러오는 중입니다…')}
              {props.fixedErrors[activeCutIndex] && (
                <button
                  type="button"
                  onClick={() => props.onRetryFixed(activeCutIndex)}
                  className="mt-3 block w-full rounded bg-white/10 p-2"
                >
                  다시 불러오기
                </button>
              )}
            </div>
          )}
          {!empty && clip && captionsEnabled && (
            <div className={disabled ? 'pointer-events-none' : ''}>
              <CaptionOverlayStage
                captions={caption.activeCaptions.filter(
                  (item) =>
                    item.id === caption.editingCaptionId ||
                    ((item.placement.startMs ?? 0) <= playbackMs &&
                      (item.placement.endMs == null ||
                        playbackMs < item.placement.endMs)),
                )}
                selectedCaptionId={caption.resolvedSelectedCaptionId}
                editingCaptionId={caption.editingCaptionId}
                previewScale={caption.captionPreviewScale}
                stageRef={caption.captionStageRef}
                overlayRef={caption.captionOverlayRef}
                inputRef={caption.captionInputRef}
                readOnly={disabled}
                onSelect={caption.setSelectedCaptionId}
                onEdit={editText}
                onTextChange={caption.handleCaptionTextChange}
                onCaptionPointerDown={(event, item) => {
                  pause();
                  captionPointers.current.add(event.pointerId);
                  history.begin();
                  caption.handleCaptionPointerDown(event, item);
                }}
                onCaptionPointerMove={caption.handleCaptionPointerMove}
                onCaptionPointerEnd={(event) => {
                  caption.handleCaptionPointerEnd(event);
                  captionPointers.current.delete(event.pointerId);
                  if (
                    !caption.editingCaptionId &&
                    captionPointers.current.size === 0
                  )
                    history.commitAfterRender();
                }}
                onResizePointerDown={caption.handleResizeHandlePointerDown}
                onResizePointerMove={caption.handleResizeHandlePointerMove}
                onResizePointerEnd={caption.handleResizeHandlePointerEnd}
              />
            </div>
          )}
          {cut?.isFixed && (
            <p className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/60 p-2 text-center text-xs">
              템플릿에 포함된 고정 컷입니다.
            </p>
          )}
        </div>
      </div>
      {caption.editingCaptionId && !empty && !disabled && (
        <CaptionToolbar
          style={caption.activeCaptionStyle}
          onChange={(style) => caption.updateActiveCaptionStyle(() => style)}
          onDone={() => editText(null)}
          onDelete={() => {
            history.begin();
            caption.deleteSelectedCaption();
            history.commitAfterRender();
          }}
        />
      )}
      <div className="flex shrink-0 items-center justify-center gap-8 py-2">
        <button
          type="button"
          aria-label={playing ? '미리보기 일시정지' : '미리보기 재생'}
          disabled={empty || !clip || disabled}
          onClick={async () => {
            if (playing) {
              pause();
              return;
            }
            if (!video.current || !clip) return;
            if (
              video.current.ended ||
              video.current.currentTime >= clip.duration
            )
              video.current.currentTime = 0;
            try {
              await video.current.play();
            } catch {
              setPlaying(false);
            }
          }}
          className="p-2 disabled:opacity-30"
        >
          {playing ? <Pause /> : <Play />}
        </button>
        <button
          type="button"
          aria-label="실행 취소"
          disabled={disabled || !history.canUndo}
          onClick={() => {
            pause();
            editText(null);
            void workspace.undo();
          }}
          className="p-2 disabled:opacity-30"
        >
          <Undo2 />
        </button>
        <button
          type="button"
          aria-label="다시 실행"
          disabled={disabled || !history.canRedo}
          onClick={() => {
            pause();
            editText(null);
            void workspace.redo();
          }}
          className="p-2 disabled:opacity-30"
        >
          <Redo2 />
        </button>
      </div>
      {(workspace.error || pickerError) && (
        <p
          role="alert"
          className="shrink-0 px-3 pb-2 text-center text-xs text-rose-300"
        >
          {workspace.error || pickerError}
          {workspace.error && !workspace.conflict && (
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => {
                void workspace.retry().catch(() => {});
              }}
            >
              저장 다시 시도
            </button>
          )}
        </p>
      )}
      {workspace.saveState !== 'saved' && (
        <p role="status" className="shrink-0 text-center text-xs">
          {workspace.saveState === 'uploading'
            ? '원본 업로드 중… 편집을 계속할 수 있습니다.'
            : workspace.saveState === 'saving'
              ? '편집 내용 저장 중…'
              : '서버에 저장되지 않은 변경사항이 있습니다.'}
        </p>
      )}
      <CutStrip
        cuts={cuts}
        clips={clips}
        activeCutIndex={activeCutIndex}
        disabled={disabled}
        busy={workspace.busy}
        errors={props.fixedErrors}
        onSelect={(index) => {
          if (isEmptyCut(index)) {
            openPicker(index);
            return;
          }
          pause();
          editText(null);
          caption.setSelectedCaptionId(null);
          props.onSelectCut(index);
        }}
      />
      <div className="flex shrink-0 justify-around border-t border-white/10 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 text-xs">
        <button
          type="button"
          disabled={disabled || cut?.isFixed}
          onClick={() => openPicker(activeCutIndex)}
          className="flex flex-col items-center gap-1 p-2 disabled:opacity-30"
        >
          <Repeat />
          교체
        </button>
        <button
          type="button"
          disabled={disabled || !clip || cut?.isFixed}
          onClick={() => {
            pause();
            editText(null);
            void workspace.reedit();
          }}
          className="flex flex-col items-center gap-1 p-2 disabled:opacity-30"
        >
          <Scissors />
          길이 다듬기
        </button>
        <button
          type="button"
          disabled={
            disabled ||
            !clip ||
            empty ||
            !captionsEnabled ||
            caption.activeCaptions.filter((c) => c.source !== 'AUTO').length >=
              MAX_CAPTIONS_PER_CLIP
          }
          onClick={() => {
            pause();
            history.begin();
            caption.addCaptionToActiveClip();
          }}
          className="flex flex-col items-center gap-1 p-2 disabled:opacity-30"
        >
          <Pencil />
          편집
        </button>
      </div>

      {workspace.editing &&
        createPortal(
          <MediaEditModal
            media={workspace.editing}
            busy={workspace.busy}
            canCancel={workspace.canCancel}
            error={workspace.error}
            onCancel={workspace.cancelEdit}
            onConfirm={workspace.confirm}
          />,
          document.body,
        )}
    </div>
  );
}
