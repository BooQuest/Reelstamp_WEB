import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useCameraCapture from './useCameraCapture';
import useCameraStream from './useCameraStream';
import { deferred, FakeMediaRecorder, makeCut, makeStream } from '../test/fixtures';

const log = vi.fn();
const makeOptions = () => ({
  cuts: [makeCut()], activeCutIndex: 0, sessionId: 10, sessionClipMap: { 1: 101 },
  previewActive: true, switchDisabled: false, shouldConfirmRetake: false,
  onRequestReplacement: vi.fn(), onSubmit: vi.fn().mockResolvedValue(undefined),
  onUploadError: vi.fn(), logVideoDebug: log,
});
let streams: MediaStream[];
let getUserMedia: ReturnType<typeof vi.fn>;
beforeEach(() => {
  streams = [];
  getUserMedia = vi.fn().mockImplementation(async () => { const stream = makeStream(); streams.push(stream); return stream; });
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia, enumerateDevices: async () => [] } });
  FakeMediaRecorder.instances = [];
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
  vi.stubGlobal('alert', vi.fn());
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('camera capture', () => {
  it('records to the captured cut and keeps the existing duration payload', async () => {
    const props = makeOptions();
    const { result } = renderHook(() => useCameraCapture(props));
    await waitFor(() => expect(result.current.stream).not.toBeNull());
    await act(async () => { await result.current.startRecording(); });
    expect(result.current.recordingStatus).toBe('recording');
    await act(async () => { result.current.stopRecording(); });
    expect(props.onSubmit).toHaveBeenCalledWith(0, expect.objectContaining({ duration: 3, mimeType: 'video/webm', blob: expect.any(Blob) }), 'recording');
    expect(result.current.recordingStatus).toBe('done');
  });

  it.each([['FORCED', 3], ['RECOMMENDED', 60]] as const)('keeps %s automatic stop at %i seconds', async (mode, seconds) => {
    const props = makeOptions();
    props.cuts = [makeCut({ durationMode: mode })];
    const { result } = renderHook(() => useCameraCapture(props));
    await waitFor(() => expect(result.current.stream).not.toBeNull());
    vi.useFakeTimers();
    await act(async () => { await result.current.startRecording(); });
    await act(async () => { vi.advanceTimersByTime(seconds * 1000 - 1); });
    expect(props.onSubmit).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });

  it('requires replacement confirmation before re-recording a recorded clip', async () => {
    const props = { ...makeOptions(), shouldConfirmRetake: true };
    const { result } = renderHook(() => useCameraCapture(props));
    await waitFor(() => expect(result.current.stream).not.toBeNull());
    await act(async () => { await result.current.startRecording(); });
    expect(props.onRequestReplacement).toHaveBeenCalledWith(0);
    expect(FakeMediaRecorder.instances).toHaveLength(0);
    await act(async () => { await result.current.startRecording({ replaceExisting: true }); });
    expect(result.current.recordingStatus).toBe('recording');
  });

  it('reports upload failure and makes recording available again', async () => {
    const props = makeOptions();
    props.onSubmit.mockRejectedValueOnce(new Error('upload failed'));
    const { result } = renderHook(() => useCameraCapture(props));
    await waitFor(() => expect(result.current.stream).not.toBeNull());
    await act(async () => { await result.current.startRecording(); });
    await act(async () => result.current.stopRecording());
    expect(result.current.recordingStatus).toBe('idle');
    expect(props.onUploadError).toHaveBeenCalledWith(0, 'upload failed');
  });

  it('does not upload an abandoned recording on unmount', async () => {
    const props = makeOptions();
    const { result, unmount } = renderHook(() => useCameraCapture(props));
    await waitFor(() => expect(result.current.stream).not.toBeNull());
    await act(async () => { await result.current.startRecording(); });
    unmount();
    expect(FakeMediaRecorder.instances[0].state).toBe('inactive');
    expect(props.onSubmit).not.toHaveBeenCalled();
    streams.forEach((stream) => stream.getTracks().forEach((track) => expect(track.stop).toHaveBeenCalled()));
  });
});

describe('camera stream lifetime', () => {
  it('stops when paused and reacquires only when resumed', async () => {
    const { result, rerender } = renderHook(({ active }) => useCameraStream(active, log), { initialProps: { active: true } });
    await waitFor(() => expect(result.current.stream).not.toBeNull());
    const count = getUserMedia.mock.calls.length;
    rerender({ active: false });
    expect(result.current.stream).toBeNull();
    expect(getUserMedia).toHaveBeenCalledTimes(count);
    rerender({ active: true });
    await waitFor(() => expect(result.current.stream).not.toBeNull());
    expect(getUserMedia.mock.calls.length).toBeGreaterThan(count);
  });

  it('releases a stream arriving after unmount', async () => {
    const pending = deferred<MediaStream>();
    getUserMedia.mockReturnValueOnce(pending.promise);
    const { unmount } = renderHook(() => useCameraStream(true, log));
    unmount();
    const stream = makeStream();
    await act(async () => { pending.resolve(stream); });
    stream.getTracks().forEach((track) => expect(track.stop).toHaveBeenCalled());
  });

  it('reports permission denial', async () => {
    getUserMedia.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    const { result } = renderHook(() => useCameraStream(true, log));
    await waitFor(() => expect(result.current.cameraError).toContain('접근이 거부'));
  });

  it('switches from the rear to the front camera', async () => {
    const { result } = renderHook(() => useCameraStream(true, log));
    await waitFor(() => expect(result.current.stream).not.toBeNull());
    const previous = result.current.stream;
    await act(async () => { await result.current.handleSwitchCamera(); });
    expect(result.current.stream).not.toBe(previous);
    expect(getUserMedia.mock.calls.some(([constraints]) => JSON.stringify(constraints).includes('user'))).toBe(true);
    previous?.getTracks().forEach((track) => expect(track.stop).toHaveBeenCalled());
  });
});
