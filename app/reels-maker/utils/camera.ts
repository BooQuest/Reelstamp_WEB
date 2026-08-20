import type { CameraFacingMode } from '../types';

export const CAMERA_RECORDING_WIDTH = 1080;
export const CAMERA_RECORDING_HEIGHT = 1920;
export const CAMERA_FRAME_RATE = 30;
export const CAMERA_PREVIEW_CROP_SCALE_LIMIT = 1.35;
export const CAMERA_TARGET_ZOOM = 1;

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

export type CameraPreviewObjectFit = 'cover' | 'contain';

export type CameraPreviewMetrics = {
  videoWidth: number;
  videoHeight: number;
  frameWidth: number;
  frameHeight: number;
  objectFit: CameraPreviewObjectFit;
};

export const buildCameraMediaConstraints = (
  facingMode: CameraFacingMode,
  deviceId?: string
): MediaStreamConstraints => {
  const video: CameraVideoConstraints = {
    facingMode: { ideal: facingMode },
    width: { ideal: CAMERA_RECORDING_WIDTH },
    height: { ideal: CAMERA_RECORDING_HEIGHT },
    aspectRatio: { ideal: CAMERA_RECORDING_WIDTH / CAMERA_RECORDING_HEIGHT },
    frameRate: { ideal: CAMERA_FRAME_RATE },
    resizeMode: { ideal: 'crop-and-scale' },
  };

  if (deviceId) {
    video.deviceId = { exact: deviceId };
  }

  return {
    video,
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

export const getCameraPreviewObjectFit = ({
  videoWidth,
  videoHeight,
  frameWidth,
  frameHeight,
  cropScaleLimit = CAMERA_PREVIEW_CROP_SCALE_LIMIT,
}: {
  videoWidth: number;
  videoHeight: number;
  frameWidth: number;
  frameHeight: number;
  cropScaleLimit?: number;
}): CameraPreviewObjectFit => {
  if (
    !isPositiveFinite(videoWidth) ||
    !isPositiveFinite(videoHeight) ||
    !isPositiveFinite(frameWidth) ||
    !isPositiveFinite(frameHeight)
  ) {
    return 'cover';
  }

  const coverScale = Math.max(frameWidth / videoWidth, frameHeight / videoHeight);
  const containScale = Math.min(frameWidth / videoWidth, frameHeight / videoHeight);
  const cropScale = coverScale / containScale;

  return cropScale > cropScaleLimit ? 'contain' : 'cover';
};
