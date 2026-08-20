import { describe, expect, it } from 'vitest';
import {
  buildCameraEnhancementConstraints,
  buildCameraMediaConstraintCandidates,
  CAMERA_TARGET_ASPECT_RATIO,
  getCameraPreviewObjectFit,
  getPreferredCameraZoomValue,
  isPortraitMediaTrackSettings,
  selectPreferredRearCameraDevice,
} from './camera';

const videoDevice = (label: string, deviceId: string) =>
  ({
    kind: 'videoinput',
    label,
    deviceId,
    groupId: 'group',
    toJSON: () => ({}),
  }) as MediaDeviceInfo;

describe('camera utilities', () => {
  it('prefers the rear wide camera over ultra-wide, telephoto, and front cameras', () => {
    const selected = selectPreferredRearCameraDevice([
      videoDevice('Front Camera', 'front'),
      videoDevice('Back Ultra Wide Camera', 'ultra'),
      videoDevice('Back Wide Camera', 'wide'),
      videoDevice('Back Telephoto Camera', 'telephoto'),
    ]);

    expect(selected?.deviceId).toBe('wide');
  });

  it('keeps the current rear camera when it is already the best wide candidate', () => {
    const selected = selectPreferredRearCameraDevice(
      [
        videoDevice('Back Camera', 'current'),
        videoDevice('Back Ultra Wide Camera', 'ultra'),
      ],
      'current'
    );

    expect(selected?.deviceId).toBe('current');
  });

  it('chooses a 1x zoom value when the camera exposes a zoom range', () => {
    expect(
      getPreferredCameraZoomValue({
        zoom: { min: 0.5, max: 5, step: 0.1 },
      } as MediaTrackCapabilities)
    ).toBe(1);
  });

  it('clamps the preferred zoom into the supported range', () => {
    expect(
      getPreferredCameraZoomValue({
        zoom: { min: 1.5, max: 5, step: 0.1 },
      } as MediaTrackCapabilities)
    ).toBe(1.5);
  });

  it('builds camera enhancement constraints from exposed capabilities', () => {
    const constraints = buildCameraEnhancementConstraints({
      zoom: { min: 0.5, max: 5, step: 0.1 },
      focusMode: ['manual', 'continuous'],
      exposureMode: ['continuous'],
      whiteBalanceMode: ['manual'],
    } as MediaTrackCapabilities);

    expect(constraints).toEqual({
      advanced: [
        { zoom: 1 },
        { focusMode: 'continuous' },
        { exposureMode: 'continuous' },
      ],
    });
  });

  it('starts camera constraint candidates with mandatory portrait video modes', () => {
    const candidates = buildCameraMediaConstraintCandidates('environment', 'rear-wide');

    expect(candidates[0]).toMatchObject({
      label: 'portrait-1080x1920-exact',
      acceptNonPortrait: false,
      fallback: false,
    });
    expect(candidates[0].constraints.video).toMatchObject({
      deviceId: { exact: 'rear-wide' },
      width: { exact: 1080 },
      height: { exact: 1920 },
      aspectRatio: { exact: CAMERA_TARGET_ASPECT_RATIO },
    });
    expect(candidates.at(-1)).toMatchObject({
      label: 'facing-mode-fallback',
      acceptNonPortrait: true,
      fallback: true,
    });
  });

  it('recognizes portrait track settings', () => {
    expect(isPortraitMediaTrackSettings({ width: 1080, height: 1920 })).toBe(true);
    expect(isPortraitMediaTrackSettings({ width: 1920, height: 1080 })).toBe(false);
  });

  it('contains a wide landscape stream instead of cropping it into a portrait frame', () => {
    expect(
      getCameraPreviewObjectFit({
        videoWidth: 1920,
        videoHeight: 1080,
        frameWidth: 390,
        frameHeight: 690,
      })
    ).toBe('contain');
  });

  it('covers the frame when the camera stream already matches the portrait preview', () => {
    expect(
      getCameraPreviewObjectFit({
        videoWidth: 1080,
        videoHeight: 1920,
        frameWidth: 390,
        frameHeight: 690,
      })
    ).toBe('cover');
  });
});
