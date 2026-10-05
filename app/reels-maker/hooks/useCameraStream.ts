'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CameraFacingMode, VideoDebugLogger } from '../types';
import {
  buildCameraEnhancementConstraints, buildCameraMediaConstraintCandidates,
  buildFallbackCameraMediaConstraints, isPortraitMediaTrackSettings,
  selectPreferredRearCameraDevice,
} from '../utils/camera';

export default function useCameraStream(active: boolean, logVideoDebug: VideoDebugLogger) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraFacingMode, setCameraFacingMode] = useState<CameraFacingMode>('environment');
  const cameraSetupInProgressRef = useRef(false);
  const switchCameraInProgressRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const diagnosticsCleanupRef = useRef<(() => void) | null>(null);
  const releaseStream = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    diagnosticsCleanupRef.current?.();
    diagnosticsCleanupRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    cameraSetupInProgressRef.current = false;
  }, []);
  const stopCamera = useCallback(() => {
    releaseStream();
    setStream(null);
  }, [releaseStream]);
  const clearError = useCallback(() => setCameraError(null), []);
  const reportError = useCallback((message: string) => setCameraError(message), []);
  const setupCamera = useCallback(
    async (overrideFacingMode?: CameraFacingMode): Promise<MediaStream | null> => {
      const targetFacingMode = overrideFacingMode ?? cameraFacingMode;
      if (cameraSetupInProgressRef.current) {
        return null;
      }

      cameraSetupInProgressRef.current = true;
      setCameraError(null);
      const request = new AbortController();
      requestRef.current = request;
      const acquiredStreams = new Set<MediaStream>();
      request.signal.addEventListener('abort', () => {
        acquiredStreams.forEach((candidate) => candidate.getTracks().forEach((track) => track.stop()));
        acquiredStreams.clear();
      }, { once: true });
      const ensureActive = (candidate: MediaStream) => {
        if (request.signal.aborted) {
          candidate.getTracks().forEach((track) => track.stop());
          throw new DOMException('Camera request cancelled', 'AbortError');
        }
        acquiredStreams.add(candidate);
      };

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('이 브라우저에서는 카메라 기능을 사용할 수 없습니다.');
        cameraSetupInProgressRef.current = false;
        return null;
      }

      try {
        type CameraConstraintAttemptDebug = {
          label: string;
          success: boolean;
          accepted?: boolean;
          portrait?: boolean;
          fallback: boolean;
          settings?: MediaTrackSettings | null;
          errorName?: string | null;
          errorMessage?: string;
        };

        const requestBestCameraStream = async (deviceId?: string) => {
          const cameraConstraintAttempts: CameraConstraintAttemptDebug[] = [];
          const candidates = buildCameraMediaConstraintCandidates(
            targetFacingMode,
            deviceId
          );

          for (const candidate of candidates) {
            try {
              const candidateStream = await navigator.mediaDevices.getUserMedia(
                candidate.constraints
              );
              ensureActive(candidateStream);
              const candidateVideoTrack = candidateStream.getVideoTracks()[0];
              const candidateSettings = candidateVideoTrack?.getSettings() ?? null;
              const portrait = isPortraitMediaTrackSettings(candidateSettings);
              const accepted = portrait || candidate.acceptNonPortrait;

              cameraConstraintAttempts.push({
                label: candidate.label,
                success: true,
                accepted,
                portrait,
                fallback: candidate.fallback,
                settings: candidateSettings,
              });

              if (accepted) {
                return {
                  mediaStream: candidateStream,
                  usedFallbackConstraints: candidate.fallback,
                  selectedCameraConstraintLabel: candidate.label,
                  cameraConstraintAttempts,
                };
              }

              candidateStream.getTracks().forEach((track) => track.stop());
            } catch (error) {
              if (request.signal.aborted) throw error;
              cameraConstraintAttempts.push({
                label: candidate.label,
                success: false,
                fallback: candidate.fallback,
                errorName: error instanceof Error ? error.name : null,
                errorMessage: error instanceof Error ? error.message : String(error),
              });
            }
          }

          throw new Error('카메라를 시작하지 못했습니다.');
        };

        const bootstrapStream = await navigator.mediaDevices.getUserMedia(
          buildFallbackCameraMediaConstraints(targetFacingMode)
        );
        ensureActive(bootstrapStream);
        const bootstrapVideoTrack = bootstrapStream.getVideoTracks()[0];
        const bootstrapVideoSettings = bootstrapVideoTrack?.getSettings() ?? null;

        if (!bootstrapStream) {
          setCameraError('카메라를 시작하지 못했습니다.');
          return null;
        }

        let selectedPreferredRearCamera = false;
        let preferredRearCameraLabel: string | null = null;
        let availableVideoInputLabels: string[] = [];

        let selectedCameraDeviceId = bootstrapVideoSettings?.deviceId;

        if (targetFacingMode === 'environment' && navigator.mediaDevices.enumerateDevices) {
          try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            availableVideoInputLabels = devices
              .filter((device) => device.kind === 'videoinput')
              .map((device) => device.label)
              .filter(Boolean);
            const preferredRearCamera = selectPreferredRearCameraDevice(
              devices,
              bootstrapVideoSettings?.deviceId
            );
            preferredRearCameraLabel = preferredRearCamera?.label || null;
            selectedCameraDeviceId =
              preferredRearCamera?.deviceId || selectedCameraDeviceId;
            selectedPreferredRearCamera = Boolean(
              preferredRearCamera?.deviceId &&
              preferredRearCamera.deviceId !== bootstrapVideoSettings?.deviceId
            );
          } catch (error) {
            logVideoDebug('camera device enumeration failed', {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        bootstrapStream.getTracks().forEach((track) => track.stop());
        ensureActive(bootstrapStream);

        const {
          mediaStream,
          usedFallbackConstraints,
          selectedCameraConstraintLabel,
          cameraConstraintAttempts,
        } = await requestBestCameraStream(selectedCameraDeviceId);

        if (!mediaStream) {
          setCameraError('카메라를 시작하지 못했습니다.');
          return null;
        }

        if (mediaStream.getAudioTracks().length === 0) {
          setCameraError('마이크 접근이 필요합니다. 권한을 허용해주세요.');
          mediaStream.getTracks().forEach((track) => track.stop());
          return null;
        }
        const videoTrack = mediaStream.getVideoTracks()[0];
        const logCameraTrackSnapshot = (tag: string) => {
          logVideoDebug('camera track snapshot', {
            tag,
            settings: videoTrack?.getSettings() ?? null,
          });
        };
        logCameraTrackSnapshot('acquired');
        let videoCapabilities: MediaTrackCapabilities | null = null;
        let enhancementConstraints: MediaTrackConstraints | null = null;
        let appliedCameraEnhancements = false;
        let cameraEnhancementError: string | null = null;
        try {
          videoCapabilities =
            videoTrack && typeof videoTrack.getCapabilities === 'function'
              ? videoTrack.getCapabilities()
              : null;
        } catch {
          videoCapabilities = null;
        }
        if (videoTrack && typeof videoTrack.applyConstraints === 'function') {
          enhancementConstraints = buildCameraEnhancementConstraints(videoCapabilities);
          if (enhancementConstraints) {
            try {
              await videoTrack.applyConstraints(enhancementConstraints);
              appliedCameraEnhancements = true;
            } catch (error) {
              cameraEnhancementError =
                error instanceof Error ? error.message : String(error);
            }
          }
        }
        ensureActive(mediaStream);
        logCameraTrackSnapshot('after-enhancements');
        if (videoTrack) {
          const handleTrackResize = () => logCameraTrackSnapshot('track-resize');
          videoTrack.addEventListener('resize', handleTrackResize);
          const diagnosticTimeout = window.setTimeout(() => {
            logCameraTrackSnapshot('t+2000');
          }, 2000);
          diagnosticsCleanupRef.current = () => {
            videoTrack.removeEventListener('resize', handleTrackResize);
            window.clearTimeout(diagnosticTimeout);
          };
        }
        logVideoDebug('camera stream ready', {
          requestedFacingMode: targetFacingMode,
          usedFallbackConstraints,
          selectedPreferredRearCamera,
          preferredRearCameraLabel,
          selectedCameraConstraintLabel,
          selectedCameraDeviceId,
          availableVideoInputLabels,
          bootstrapSettings: bootstrapVideoSettings,
          cameraConstraintAttempts,
          settings: videoTrack?.getSettings() ?? null,
          constraints: videoTrack?.getConstraints() ?? null,
          capabilities: videoCapabilities,
          enhancementConstraints,
          appliedCameraEnhancements,
          cameraEnhancementError,
          audioTrackCount: mediaStream.getAudioTracks().length,
        });
        if (streamRef.current && streamRef.current !== mediaStream) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }
        streamRef.current = mediaStream;
        setStream(mediaStream);
        return mediaStream;
      } catch {
        if (request.signal.aborted) return null;
        setCameraError('카메라/마이크 접근이 거부되었어요. 권한을 확인해주세요.');
        return null;
      } finally {
        if (requestRef.current === request) cameraSetupInProgressRef.current = false;
      }
    },
    [cameraFacingMode, logVideoDebug]
  );
  const handleSwitchCamera = useCallback(async (disabled = false) => {
    if (switchCameraInProgressRef.current || disabled) {
      return;
    }

    switchCameraInProgressRef.current = true;
    try {
      const nextMode: CameraFacingMode = cameraFacingMode === 'environment' ? 'user' : 'environment';
      setCameraFacingMode(nextMode);
      stopCamera();
      await setupCamera(nextMode);
    } finally {
      switchCameraInProgressRef.current = false;
    }
  }, [cameraFacingMode, setupCamera, stopCamera]);
  useEffect(() => {
    if (active) {
      if (!stream) void setupCamera();
    } else stopCamera();
  }, [active, setupCamera, stopCamera, stream]);
  useEffect(() => releaseStream, [releaseStream]);
  return { stream, cameraError, setupCamera, stopCamera, handleSwitchCamera, clearError, reportError };
}
