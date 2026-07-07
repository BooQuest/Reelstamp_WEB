import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AutoCaptionEditor from './AutoCaptionEditor';
import { DEFAULT_CAPTION_STYLE } from '../constants';
import type { CaptionItem } from '../types';

const caption: CaptionItem = {
  id: 'caption-1',
  text: '기존 자막',
  source: 'TEMPLATE',
  role: 'OVERLAY',
  placement: { type: 'CLIP', clipId: 10 },
  zIndex: 1,
  style: DEFAULT_CAPTION_STYLE,
};

const autoCaption: CaptionItem = {
  id: 'auto-1',
  text: '음성 자막',
  source: 'AUTO',
  role: 'SPEECH',
  placement: { type: 'CLIP', clipId: 10 },
  zIndex: 2,
  style: { ...DEFAULT_CAPTION_STYLE, yRatio: 0.82 },
};

const baseProps = () => ({
  sessionId: 1,
  cuts: [{ order: 1, label: '4초', durationSeconds: 4, isFixed: false }],
  clips: [null],
  clipPosters: {},
  sessionClipMap: { 1: 10 },
  captions: [caption],
  setCaptions: vi.fn(),
  activeCutIndex: 0,
  setActiveCutIndex: vi.fn(),
  captionsEnabled: true,
  setCaptionsEnabled: vi.fn(),
  autoCaptionAvailable: false,
  remainingAttempts: 3,
  staleClipIds: [] as number[],
  acceptedStaleClipIds: [] as number[],
  job: null,
  jobError: null,
  isProcessing: false,
  isRegisteredUser: true,
  loginHref: '/login',
  onStartAutoCaption: vi.fn().mockResolvedValue(null),
  onAcceptStale: vi.fn(),
  onBack: vi.fn(),
  onComplete: vi.fn(),
  handleFrameRef: vi.fn(),
  captionStageRef: { current: null },
  captionOverlayRef: { current: null },
  captionInputRef: { current: null },
  captionPreviewScale: 0.3,
  selectedCaptionId: 'caption-1',
  editingCaptionId: null,
  setSelectedCaptionId: vi.fn(),
  setEditingCaptionId: vi.fn(),
  onCaptionPointerDown: vi.fn(),
  onCaptionPointerMove: vi.fn(),
  onCaptionPointerEnd: vi.fn(),
  onResizePointerDown: vi.fn(),
  onResizePointerMove: vi.fn(),
  onResizePointerEnd: vi.fn(),
  onCaptionTextChange: vi.fn(),
  onToggleBox: vi.fn(),
});

describe('AutoCaptionEditor', () => {
  beforeEach(() => {
    sessionStorage.clear();
    Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: function play() {
        Object.defineProperty(this, 'paused', {
          configurable: true,
          value: false,
        });
        this.dispatchEvent(new Event('play'));
        return Promise.resolve();
      },
    });
    Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      value: function pause() {
        Object.defineProperty(this, 'paused', {
          configurable: true,
          value: true,
        });
        this.dispatchEvent(new Event('pause'));
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('blocks final completion until changed clips are accepted', () => {
    const props = {
      ...baseProps(),
      staleClipIds: [10],
    };
    render(<AutoCaptionEditor {...props} />);

    expect(screen.getByRole('button', { name: '완료' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '현재 자막 그대로 사용' }));
    expect(props.onAcceptStale).toHaveBeenCalledWith([10]);
  });

  it('asks before the first external STT request', async () => {
    const props = {
      ...baseProps(),
      autoCaptionAvailable: true,
    };
    render(<AutoCaptionEditor {...props} />);

    await waitFor(() =>
      expect(screen.getByText('음성으로 자막을 만들까요?')).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole('button', { name: '지금 만들기' }));
    await waitFor(() => expect(props.onStartAutoCaption).toHaveBeenCalledTimes(1));
    expect(
      sessionStorage.getItem('reelstamp:auto-caption-prompt:1')
    ).toBe('seen');
  });

  it('labels auto captions separately and excludes them from manual caption limit', () => {
    const props = {
      ...baseProps(),
      captions: [caption, autoCaption],
    };
    render(<AutoCaptionEditor {...props} />);

    expect(screen.getByText('기본 자막')).toBeInTheDocument();
    expect(screen.getByText('음성인식')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '자막 추가 (1/5)' })
    ).toBeInTheDocument();
  });

  it('regenerates only existing auto captions after confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const props = {
      ...baseProps(),
      autoCaptionAvailable: true,
      job: {
        jobId: 'job-1',
        status: 'COMPLETED' as const,
        attemptNo: 1,
        remainingAttempts: 2,
        enabled: true,
        staleClipIds: [],
        clips: [],
      },
    };
    render(<AutoCaptionEditor {...props} />);

    fireEvent.click(screen.getByRole('button', { name: '다시 생성 (3)' }));

    expect(confirmSpy).toHaveBeenCalledWith(
      '기존 음성인식 자막만 새 결과로 교체합니다. 템플릿/사용자 자막은 유지됩니다.'
    );
    await waitFor(() => expect(props.onStartAutoCaption).toHaveBeenCalledTimes(1));
    confirmSpy.mockRestore();
  });

  it('creates timed auto chunks from completed job words when saved auto captions are missing', async () => {
    const props = {
      ...baseProps(),
      setCaptions: vi.fn(),
      job: {
        jobId: 'job-words',
        status: 'COMPLETED' as const,
        attemptNo: 1,
        remainingAttempts: 2,
        enabled: true,
        staleClipIds: [],
        clips: [
          {
            clipId: 10,
            status: 'COMPLETED' as const,
            text: '음성 자막입니다',
            stale: false,
            words: [
              { text: '음성', startMs: 0, endMs: 200 },
              { text: '자막입니다', startMs: 220, endMs: 700 },
            ],
          },
        ],
      },
    };
    render(<AutoCaptionEditor {...props} />);

    await waitFor(() => expect(props.setCaptions).toHaveBeenCalled());
    const generated = props.setCaptions.mock.calls
      .filter((call) => typeof call[0] === 'function')
      .flatMap((call) => {
        const updater = call[0] as (current: CaptionItem[]) => CaptionItem[];
        return updater([caption]).filter(
          (item) => item.source === 'AUTO' && item.role === 'SPEECH'
        );
      });
    expect(generated).toHaveLength(1);
    expect(generated[0].placement).toMatchObject({
      type: 'CLIP',
      clipId: 10,
      startMs: 0,
    });
  });

  it('pauses preview without resetting the current clip time', async () => {
    const props = {
      ...baseProps(),
      clips: [
        {
          blob: new Blob(['video']),
          url: 'blob:preview-1',
          duration: 4,
          mimeType: 'video/mp4',
        },
      ],
    };
    render(<AutoCaptionEditor {...props} />);

    const video = document.querySelector('video') as HTMLVideoElement;
    video.currentTime = 2.4;
    fireEvent.timeUpdate(video);
    fireEvent.play(video);

    const pauseButton = await screen.findByRole('button', { name: '일시 정지' });
    fireEvent.click(pauseButton);

    await waitFor(() => expect(video.currentTime).toBeCloseTo(2.4));
  });

  it('seeks the global timeline to the matching clip', () => {
    const props = {
      ...baseProps(),
      cuts: [
        { order: 1, label: '4초', durationSeconds: 4, isFixed: false },
        { order: 2, label: '6초', durationSeconds: 6, isFixed: false },
      ],
      clips: [
        {
          blob: new Blob(['one']),
          url: 'blob:preview-1',
          duration: 4,
          mimeType: 'video/mp4',
        },
        {
          blob: new Blob(['two']),
          url: 'blob:preview-2',
          duration: 6,
          mimeType: 'video/mp4',
        },
      ],
      sessionClipMap: { 1: 10, 2: 11 },
    };
    render(<AutoCaptionEditor {...props} />);

    const slider = screen.getByRole('slider', {
      name: '전체 미리보기 타임라인',
    });
    slider.getBoundingClientRect = vi.fn(
      () =>
        ({
          left: 0,
          right: 100,
          top: 0,
          bottom: 10,
          width: 100,
          height: 10,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect
    );
    fireEvent.pointerDown(slider, { clientX: 75, pointerId: 1 });

    expect(props.setActiveCutIndex).toHaveBeenCalledWith(1);
  });
});
