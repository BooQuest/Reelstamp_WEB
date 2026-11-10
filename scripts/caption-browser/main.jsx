// Browser-only fixture: real gallery UI, caption hook and history; no server writes.
import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import '../../app/globals.css';
import GalleryMaker from '../../app/reels-maker/gallery/GalleryMaker';
import useCaptionEditor from '../../app/reels-maker/hooks/useCaptionEditor';
import useEditorHistory from '../../app/reels-maker/gallery/useEditorHistory';
import { DEFAULT_CAPTION_STYLE } from '../../app/reels-maker/constants';
const noop = () => {};
const clip = {
  url:
    'data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><rect width="100%" height="100%" fill="#456"/></svg>',
    ),
  kind: 'image',
  duration: 5,
  clipId: 1,
  revisionId: 'fixture',
  mediaKind: 'image',
};
const cuts = [
  {
    id: 'cut',
    order: 1,
    durationSeconds: 5,
    label: '5초',
    guideText: '',
    isFixed: false,
  },
];
function Fixture() {
  const query = new URLSearchParams(location.search);
  const style = {
    ...DEFAULT_CAPTION_STYLE,
    yRatio: 0.4,
    textAlign: query.get('align') || 'left',
    styleVersion: query.get('version') || 'CAPTION_RENDER_V1',
    fontFamily: query.get('font') || 'ReelstampCaptionPretendard',
    boxed: query.get('boxed') !== 'false',
  };
  const [captions, setCaptions] = useState([
    {
      id: 'original',
      text: query.get('text') || '가운데 정렬\n두 번째 줄',
      source: 'USER',
      role: 'OVERLAY',
      placement: { type: 'CLIP', clipId: 1 },
      zIndex: 1,
      style,
    },
  ]);
  const captionsRef = useRef(captions);
  useLayoutEffect(() => {
    captionsRef.current = captions;
  }, [captions]);
  const frame = useRef(null);
  const caption = useCaptionEditor({
    activeClipId: 1,
    showCaptionStage: true,
    stage: 'capture',
    captions,
    setCaptions,
    captionsRef,
    cameraFrameRef: frame,
  });
  const snapshot = {
    clips: [{ clipId: 1, revisionId: 'fixture' }],
    captions,
    captionsEnabled: true,
  };
  const history = useEditorHistory(snapshot, async (state) =>
    setCaptions(state.captions),
  );
  const workspace = {
    history,
    busy: false,
    editing: null,
    error: null,
    saveState: 'saved',
    openFile: noop,
    targetFor: () => null,
    undo: () => history.move(-1),
    redo: () => history.move(1),
    clearError: noop,
    reedit: noop,
  };
  useEffect(() => {
    window.captionFixture = {
      captions,
      previewScale: caption.captionPreviewScale,
      editing: caption.editingCaptionId,
    };
  }, [captions, caption.captionPreviewScale, caption.editingCaptionId]);
  return (
    <div style={{ height: '100dvh' }}>
      <GalleryMaker
        workspace={workspace}
        session={{ sessionId: 1, templateId: 'fixture' }}
        cuts={cuts}
        clips={[clip]}
        captionsEnabled
        activeCutIndex={0}
        onSelectCut={noop}
        onGuide={noop}
        onNext={noop}
        allDone
        header="자막 검증"
        captionEditor={caption}
        fixedErrors={{}}
        onRetryFixed={noop}
        paused={false}
      />
    </div>
  );
}
createRoot(document.getElementById('root')).render(<Fixture />);
