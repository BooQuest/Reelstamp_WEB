import type { CropRegion, MediaEdit } from './types';

export const MAX_CLIP_SECONDS = 3600;
export const clamp = (n: number, low: number, high: number) =>
  Math.max(low, Math.min(high, n));
export function coverCrop(width: number, height: number): CropRegion {
  const w = Math.min(1, ((9 / 16) * height) / width);
  const h = Math.min(1, ((16 / 9) * width) / height);
  return { x: (1 - w) / 2, y: (1 - h) / 2, width: w, height: h };
}
export function zoomCrop(
  crop: CropRegion,
  factor: number,
  width: number,
  height: number,
): CropRegion {
  const base = coverCrop(width, height);
  const w = clamp(crop.width / factor, base.width / 4, base.width);
  const h = (((w * width) / height) * 16) / 9;
  return {
    x: clamp(crop.x + (crop.width - w) / 2, 0, 1 - w),
    y: clamp(crop.y + (crop.height - h) / 2, 0, 1 - h),
    width: w,
    height: h,
  };
}
export function moveCrop(crop: CropRegion, dx: number, dy: number): CropRegion {
  return {
    ...crop,
    x: clamp(crop.x + dx, 0, 1 - crop.width),
    y: clamp(crop.y + dy, 0, 1 - crop.height),
  };
}
export function setEditDuration(
  edit: MediaEdit,
  duration: number,
  max: number,
): MediaEdit {
  if (
    !Number.isFinite(duration) ||
    duration < 0.1 ||
    duration > Math.min(max, MAX_CLIP_SECONDS) ||
    Math.abs(duration * 10 - Math.round(duration * 10)) > 1e-6
  )
    throw new Error(
      '0.1초 단위로 원본 길이 이내의 값을 입력해 주세요. (최대 3,600초)',
    );
  return {
    ...edit,
    duration,
    start: clamp(edit.start, 0, Math.max(0, max - duration)),
  };
}
export const floorTenth = (n: number) => Math.floor((n + 1e-8) * 10) / 10;
