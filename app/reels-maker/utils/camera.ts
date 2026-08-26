import type { CameraFacingMode } from '../types';

export const CAMERA_RECORDING_WIDTH = 1080;
export const CAMERA_RECORDING_HEIGHT = 1920;
export const CAMERA_FRAME_RATE = 30;
export const CAMERA_TARGET_ZOOM = 1;
export const CAMERA_TARGET_ASPECT_RATIO =
  CAMERA_RECORDING_WIDTH / CAMERA_RECORDING_HEIGHT;

type CameraVideoConstraints = MediaTrackConstraints & {
  resizeMode?: ConstrainDOMString;
};

type CameraTrackCapabilities = MediaTrackCapabilities & {
  zoom?: {
    min?: number;
    max?: number;
    step?: number;
  };
  focusMode?: string[];
  exposureMode?: string[];
  whiteBalanceMode?: string[];
};

type CameraTrackConstraintSet = MediaTrackConstraintSet & {
  zoom?: number;
  focusMode?: string;
  exposureMode?: string;
  whiteBalanceMode?: string;
};

export type CameraPreviewMetrics = {
  reason: string;
  videoWidth: number;
  videoHeight: number;
  frameWidth: number;
  frameHeight: number;
  objectFit: 'cover';
  trackSettings: MediaTrackSettings[];
};

export type CameraMediaConstraintCandidate = {
  label: string;
  constraints: MediaStreamConstraints;
  acceptNonPortrait: boolean;
  fallback: boolean;
};

type CameraResolutionConstraintMode = 'exact' | 'ideal';

const buildVideoConstraints = ({
  facingMode,
  deviceId,
  width,
  height,
  mode,
  includeAspectRatio = true,
  includeResizeMode = true,
}: {
  facingMode: CameraFacingMode;
  deviceId?: string;
  width?: number;
  height?: number;
  mode?: CameraResolutionConstraintMode;
  includeAspectRatio?: boolean;
  includeResizeMode?: boolean;
}): CameraVideoConstraints => {
  const video: CameraVideoConstraints = {
    facingMode: { ideal: facingMode },
    frameRate: { ideal: CAMERA_FRAME_RATE },
  };

  if (includeResizeMode) {
    video.resizeMode = { ideal: 'crop-and-scale' };
  }
  if (deviceId) {
    video.deviceId = { exact: deviceId };
  }
  if (width && height && mode) {
    video.width = { [mode]: width };
    video.height = { [mode]: height };
    if (includeAspectRatio) {
      video.aspectRatio = { [mode]: width / height };
    }
  }

  return video;
};

export const buildCameraMediaConstraints = (
  facingMode: CameraFacingMode,
  deviceId?: string
): MediaStreamConstraints => {
  return {
    video: buildVideoConstraints({
      facingMode,
      deviceId,
      width: CAMERA_RECORDING_WIDTH,
      height: CAMERA_RECORDING_HEIGHT,
      mode: 'ideal',
    }),
    audio: true,
  };
};

export const buildFallbackCameraMediaConstraints = (
  facingMode: CameraFacingMode,
  deviceId?: string
): MediaStreamConstraints => ({
  video: deviceId
    ? { deviceId: { exact: deviceId } }
    : { facingMode: { ideal: facingMode } },
  audio: true,
});

export const buildCameraMediaConstraintCandidates = (
  facingMode: CameraFacingMode,
  deviceId?: string
): CameraMediaConstraintCandidate[] => {
  const candidates: CameraMediaConstraintCandidate[] = [
    {
      label: 'portrait-1080x1920-ideal-no-aspect',
      constraints: {
        video: buildVideoConstraints({
          facingMode,
          deviceId,
          width: 1080,
          height: 1920,
          mode: 'ideal',
          includeAspectRatio: false,
          includeResizeMode: false,
        }),
        audio: true,
      },
      acceptNonPortrait: false,
      fallback: false,
    },
    {
      label: 'portrait-720x1280-ideal-no-aspect',
      constraints: {
        video: buildVideoConstraints({
          facingMode,
          deviceId,
          width: 720,
          height: 1280,
          mode: 'ideal',
          includeAspectRatio: false,
          includeResizeMode: false,
        }),
        audio: true,
      },
      acceptNonPortrait: false,
      fallback: false,
    },
    {
      label: 'portrait-1080x1920-exact',
      constraints: {
        video: buildVideoConstraints({
          facingMode,
          deviceId,
          width: 1080,
          height: 1920,
          mode: 'exact',
        }),
        audio: true,
      },
      acceptNonPortrait: false,
      fallback: false,
    },
    {
      label: 'portrait-720x1280-exact',
      constraints: {
        video: buildVideoConstraints({
          facingMode,
          deviceId,
          width: 720,
          height: 1280,
          mode: 'exact',
        }),
        audio: true,
      },
      acceptNonPortrait: false,
      fallback: false,
    },
    {
      label: 'photo-portrait-1080x1440-exact',
      constraints: {
        video: buildVideoConstraints({
          facingMode,
          deviceId,
          width: 1080,
          height: 1440,
          mode: 'exact',
        }),
        audio: true,
      },
      acceptNonPortrait: false,
      fallback: false,
    },
    {
      label: 'photo-portrait-720x960-exact',
      constraints: {
        video: buildVideoConstraints({
          facingMode,
          deviceId,
          width: 720,
          height: 960,
          mode: 'exact',
        }),
        audio: true,
      },
      acceptNonPortrait: false,
      fallback: false,
    },
    {
      label: 'portrait-1080x1920-ideal',
      constraints: buildCameraMediaConstraints(facingMode, deviceId),
      acceptNonPortrait: false,
      fallback: false,
    },
  ];

  if (deviceId) {
    candidates.push({
      label: 'selected-device-fallback',
      constraints: buildFallbackCameraMediaConstraints(facingMode, deviceId),
      acceptNonPortrait: true,
      fallback: true,
    });
  }

  candidates.push({
    label: 'facing-mode-fallback',
    constraints: buildFallbackCameraMediaConstraints(facingMode),
    acceptNonPortrait: true,
    fallback: true,
  });

  return candidates;
};

const includesAny = (value: string, terms: string[]) =>
  terms.some((term) => value.includes(term));

const scoreRearCameraDevice = (
  device: MediaDeviceInfo,
  currentDeviceId?: string
) => {
  if (device.kind !== 'videoinput') return Number.NEGATIVE_INFINITY;

  const label = device.label.trim().toLowerCase();
  if (!label) return 0;

  let score = 0;
  if (includesAny(label, ['back', 'rear', 'environment', '후면', '뒤'])) {
    score += 80;
  }
  if (includesAny(label, ['front', 'user', 'facetime', 'truedepth', '전면', '앞'])) {
    score -= 120;
  }
  if (includesAny(label, ['ultra wide', 'ultrawide', '초광각'])) {
    score -= 70;
  }
  if (includesAny(label, ['telephoto', '망원'])) {
    score -= 70;
  }
  if (includesAny(label, ['wide', '와이드', '광각'])) {
    score += 25;
  }
  if (includesAny(label, ['dual', 'triple', '듀얼', '트리플'])) {
    score += 8;
  }
  if (device.deviceId && currentDeviceId && device.deviceId === currentDeviceId) {
    score += 2;
  }

  return score;
};

export const selectPreferredRearCameraDevice = (
  devices: MediaDeviceInfo[],
  currentDeviceId?: string
) => {
  const videoInputs = devices.filter((device) => device.kind === 'videoinput');
  if (videoInputs.length === 0) return null;

  const scored = videoInputs
    .map((device) => ({
      device,
      score: scoreRearCameraDevice(device, currentDeviceId),
    }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  return best && best.score > 0 ? best.device : null;
};

const readZoomRange = (capabilities: MediaTrackCapabilities | null) => {
  const zoom = (capabilities as CameraTrackCapabilities | null)?.zoom;
  if (!zoom || typeof zoom !== 'object') return null;

  const min = typeof zoom.min === 'number' ? zoom.min : null;
  const max = typeof zoom.max === 'number' ? zoom.max : null;
  if (min === null || max === null || !Number.isFinite(min) || !Number.isFinite(max)) {
    return null;
  }

  return {
    min,
    max,
    step:
      typeof zoom.step === 'number' && Number.isFinite(zoom.step) && zoom.step > 0
        ? zoom.step
        : null,
  };
};

export const getPreferredCameraZoomValue = (
  capabilities: MediaTrackCapabilities | null,
  targetZoom: number = CAMERA_TARGET_ZOOM
) => {
  const zoomRange = readZoomRange(capabilities);
  if (!zoomRange) return null;

  const clamped = Math.min(zoomRange.max, Math.max(zoomRange.min, targetZoom));
  if (!zoomRange.step) return clamped;

  const stepped =
    Math.round((clamped - zoomRange.min) / zoomRange.step) * zoomRange.step +
    zoomRange.min;
  return Math.min(zoomRange.max, Math.max(zoomRange.min, Number(stepped.toFixed(6))));
};

const pushContinuousModeConstraint = (
  advanced: CameraTrackConstraintSet[],
  capabilities: CameraTrackCapabilities,
  key: 'focusMode' | 'exposureMode' | 'whiteBalanceMode'
) => {
  const modes = capabilities[key];
  if (!Array.isArray(modes) || !modes.includes('continuous')) return;
  advanced.push({ [key]: 'continuous' });
};

export const buildCameraEnhancementConstraints = (
  capabilities: MediaTrackCapabilities | null,
  targetZoom: number = CAMERA_TARGET_ZOOM
): MediaTrackConstraints | null => {
  const cameraCapabilities = capabilities as CameraTrackCapabilities | null;
  if (!cameraCapabilities) return null;

  const advanced: CameraTrackConstraintSet[] = [];
  const zoom = getPreferredCameraZoomValue(cameraCapabilities, targetZoom);
  if (zoom !== null) {
    advanced.push({ zoom });
  }
  pushContinuousModeConstraint(advanced, cameraCapabilities, 'focusMode');
  pushContinuousModeConstraint(advanced, cameraCapabilities, 'exposureMode');
  pushContinuousModeConstraint(advanced, cameraCapabilities, 'whiteBalanceMode');

  return advanced.length > 0 ? ({ advanced } as MediaTrackConstraints) : null;
};

const isPositiveFinite = (value: number) =>
  Number.isFinite(value) && value > 0;

export const getMediaTrackSettingsSize = (
  settings: MediaTrackSettings | null | undefined
) => ({
  width:
    typeof settings?.width === 'number' && Number.isFinite(settings.width)
      ? settings.width
      : 0,
  height:
    typeof settings?.height === 'number' && Number.isFinite(settings.height)
      ? settings.height
      : 0,
});

export const isPortraitMediaTrackSettings = (
  settings: MediaTrackSettings | null | undefined
) => {
  const { width, height } = getMediaTrackSettingsSize(settings);
  return isPositiveFinite(width) && isPositiveFinite(height) && height >= width;
};
