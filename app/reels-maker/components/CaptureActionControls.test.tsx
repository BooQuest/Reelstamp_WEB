import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CaptureActionControls from './CaptureActionControls';

const baseProps = () => ({
  recordingStatus: 'idle' as const,
  galleryPreviewUrl: null,
  canRetake: false,
  isGalleryDisabled: false,
  isRecordDisabled: false,
  isSwitchCameraDisabled: false,
  onOpenGallery: vi.fn(),
  onStartRecording: vi.fn(),
  onStopRecording: vi.fn(),
  onRequestRetake: vi.fn(),
  onSwitchCamera: vi.fn(),
});

describe('CaptureActionControls', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('routes idle controls to gallery, record, and switch handlers', () => {
    const props = baseProps();
    render(<CaptureActionControls {...props} />);

    fireEvent.click(screen.getByRole('button', { name: '갤러리' }));
    fireEvent.click(screen.getByRole('button', { name: '현재 컷 촬영' }));
    fireEvent.click(screen.getByRole('button', { name: '전면/후면 카메라 전환' }));

    expect(props.onOpenGallery).toHaveBeenCalledTimes(1);
    expect(props.onStartRecording).toHaveBeenCalledTimes(1);
    expect(props.onSwitchCamera).toHaveBeenCalledTimes(1);
  });

  it('turns the center control into stop while recording', () => {
    const props = baseProps();
    render(<CaptureActionControls {...props} recordingStatus="recording" />);

    fireEvent.click(screen.getByRole('button', { name: '촬영 종료' }));

    expect(props.onStopRecording).toHaveBeenCalledTimes(1);
    expect(props.onStartRecording).not.toHaveBeenCalled();
  });

  it('turns the center control into retake when the current cut has media', () => {
    const props = baseProps();
    render(<CaptureActionControls {...props} canRetake galleryPreviewUrl="poster.jpg" />);

    fireEvent.click(screen.getByRole('button', { name: '현재 컷 다시찍기' }));

    expect(props.onRequestRetake).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '갤러리' }).querySelector('img')).toBeTruthy();
  });
});
