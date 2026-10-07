'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MakerCut, RecorderStatus, SubmitClip, VideoDebugLogger } from '../types';
import { DURATION_MODE_FORCED, RECOMMENDED_AUTO_STOP_SECONDS } from '../constants';
import { createConfiguredRecorder } from '../utils/media/recorder';
import { getErrorMessage } from '../utils/errors';
import useCameraStream from './useCameraStream';

type Options = {
  cuts: MakerCut[];
  activeCutIndex: number;
  sessionId: number | null;
  sessionClipMap: Record<number, number>;
  previewActive: boolean;
  switchDisabled: boolean;
  shouldConfirmRetake: boolean;
  onRequestReplacement: (index: number) => void;
  onSubmit: SubmitClip;
  onUploadError: (index: number, message: string) => void;
  logVideoDebug: VideoDebugLogger;
};

export default function useCameraCapture({ cuts, activeCutIndex, sessionId, sessionClipMap,
  previewActive, switchDisabled, shouldConfirmRetake, onRequestReplacement, onSubmit, onUploadError, logVideoDebug }: Options) {
  const camera = useCameraStream(previewActive, logVideoDebug);
  const { stream, setupCamera, reportError: setCameraError } = camera;
  const activeCut = cuts[activeCutIndex] ?? null;
  const operationRef = useRef(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recordTimeoutRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const recordingCutRef = useRef<number>(0);
  const recordingMimeTypeRef = useRef<string>('video/webm');
  const [recordingStatus, setRecordingStatus] = useState<RecorderStatus>('idle');
  const [recordingElapsedSeconds, setRecordingElapsedSeconds] = useState<number | null>(null);
  const stopRecording = useCallback(() => {
    if (recordTimeoutRef.current) {
      window.clearTimeout(recordTimeoutRef.current);
      recordTimeoutRef.current = null;
    }
    if (countdownTimerRef.current) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setRecordingElapsedSeconds(null);

    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
  }, []);
  const disposeRecording = useCallback(() => {
    operationRef.current += 1;
    if (recordTimeoutRef.current !== null) window.clearTimeout(recordTimeoutRef.current);
    if (countdownTimerRef.current !== null) window.clearInterval(countdownTimerRef.current);
    recordTimeoutRef.current = null;
    countdownTimerRef.current = null;
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.onstop = null;
      recorder.ondataavailable = null;
      recorder.onerror = null;
      if (recorder.state !== 'inactive') recorder.stop();
    }
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);
  const reset = useCallback(() => {
    disposeRecording();
    setRecordingStatus('idle');
    setRecordingElapsedSeconds(null);
  }, [disposeRecording]);
  useEffect(() => disposeRecording, [disposeRecording, sessionId]);
  const createRecorder = useCallback(
    (recordingStream: MediaStream) => {
      const configured = createConfiguredRecorder(recordingStream, 'camera', logVideoDebug);
      if (!configured) return null;

      recordingMimeTypeRef.current =
        configured.recorder.mimeType || configured.selectedMimeType || 'video/webm';
      return configured.recorder;
    },
    [logVideoDebug]
  );
  const startRecording = async (options: { replaceExisting?: boolean } = {}) => {
    if (recordingStatus === 'recording') return;
    const operation = operationRef.current;
    if (!activeCut) {
      setCameraError('템플릿 컷 정보를 불러오지 못했습니다.');
      return;
    }
    if (activeCut.isFixed) {
      return;
    }
    const activeOrder = activeCut.order ?? activeCutIndex + 1;
    if (!sessionId || !sessionClipMap[activeOrder]) {
      setCameraError('릴스 제작 세션을 준비 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    if (shouldConfirmRetake && !options.replaceExisting) {
      onRequestReplacement(activeCutIndex);
      return;
    }

    let recordingStream =
      stream && stream.getTracks().some((track) => track.readyState === 'live')
        ? stream
        : null;
    if (!recordingStream) {
      recordingStream = await setupCamera();
    }
    if (operation !== operationRef.current) return;
    if (!recordingStream || recordingStream.getAudioTracks().length === 0) {
      setCameraError('마이크 권한이 필요합니다. 설정에서 허용해주세요.');
      return;
    }

    const recorder = createRecorder(recordingStream);
    if (!recorder) {
      setCameraError('이 브라우저에서는 녹화를 지원하지 않습니다.');
      return;
    }

    recorderRef.current = recorder;
    chunksRef.current = [];
    recordingCutRef.current = activeCutIndex;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      if (operation !== operationRef.current) return;
      const recordedIndex = recordingCutRef.current;
      const mimeType = recorder.mimeType || recordingMimeTypeRef.current || 'video/webm';
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const recordedCut = cuts[recordedIndex];
      const outputVideoTrackSettings = recordingStream
        .getVideoTracks()
        .map((track) => track.getSettings());
      logVideoDebug('camera track snapshot', {
        tag: 'after-record',
        settings: outputVideoTrackSettings[0] ?? null,
      });
      logVideoDebug('camera output blob', {
        type: blob.type,
        size: blob.size,
        duration: recordedCut?.durationSeconds ?? activeCut.durationSeconds,
        recorderMimeType: recorder.mimeType,
        recorderVideoBitsPerSecond: recorder.videoBitsPerSecond,
        recorderAudioBitsPerSecond: recorder.audioBitsPerSecond,
        videoTrackSettings: outputVideoTrackSettings,
      });
      onSubmit(
        recordedIndex,
        {
          blob,
          duration: recordedCut?.durationSeconds ?? activeCut.durationSeconds,
          mimeType,
        },
        'recording'
      ).then(() => {
        if (operation === operationRef.current) setRecordingStatus('done');
      }).catch((error: unknown) => {
        if (operation !== operationRef.current || (error instanceof DOMException && error.name === 'AbortError')) return;
        const message = getErrorMessage(error, '클립 업로드에 실패했습니다.');
        onUploadError(recordedIndex, message);
        setRecordingStatus('idle');
        setRecordingElapsedSeconds(null);
        alert(message || '클립 업로드에 실패했습니다. 다시 시도해주세요.');
      });
    };

    recorder.start();
    setRecordingStatus('recording');
    setRecordingElapsedSeconds(0);

    const isForcedDurationMode = activeCut.durationMode === DURATION_MODE_FORCED;
    const autoStopSeconds = isForcedDurationMode
      ? Math.max(0, activeCut.durationSeconds)
      : RECOMMENDED_AUTO_STOP_SECONDS;

    const startedAt = Date.now();
    countdownTimerRef.current = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setRecordingElapsedSeconds(elapsed);
    }, 500);

    recordTimeoutRef.current = window.setTimeout(() => {
      stopRecording();
    }, autoStopSeconds * 1000);
  };
  return {
    stream, cameraError: camera.cameraError, recordingStatus, recordingElapsedSeconds,
    startRecording, stopRecording, stopCamera: camera.stopCamera, reset, clearError: camera.clearError,
    handleSwitchCamera: () => camera.handleSwitchCamera(switchDisabled || recordingStatus === 'recording'),
  };
}
