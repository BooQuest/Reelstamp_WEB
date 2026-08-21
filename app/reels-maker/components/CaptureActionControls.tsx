'use client';

/* eslint-disable @next/next/no-img-element */

import { Image as ImageIcon, RotateCcw, SwitchCamera } from 'lucide-react';
import type { RecorderStatus } from '../types';

type Props = {
  recordingStatus: RecorderStatus;
  galleryPreviewUrl?: string | null;
  canRetake: boolean;
  isGalleryDisabled: boolean;
  isRecordDisabled: boolean;
  isSwitchCameraDisabled: boolean;
  onOpenGallery: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onRequestRetake: () => void;
  onSwitchCamera: () => void;
};

export default function CaptureActionControls({
  recordingStatus,
  galleryPreviewUrl,
  canRetake,
  isGalleryDisabled,
  isRecordDisabled,
  isSwitchCameraDisabled,
  onOpenGallery,
  onStartRecording,
  onStopRecording,
  onRequestRetake,
  onSwitchCamera,
}: Props) {
  const isRecording = recordingStatus === 'recording';
  const centerButtonLabel = isRecording
    ? '촬영 종료'
    : canRetake
      ? '현재 컷 다시찍기'
      : '현재 컷 촬영';

  const handleCenterClick = () => {
    if (isRecording) {
      onStopRecording();
      return;
    }
    if (canRetake) {
      onRequestRetake();
      return;
    }
    onStartRecording();
  };

  return (
    <div className="grid grid-cols-3 items-center px-4">
      <div className="flex justify-start">
        <button
          type="button"
          onClick={onOpenGallery}
          disabled={isGalleryDisabled}
          className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/25 bg-black/45 text-white shadow-xl backdrop-blur transition hover:scale-105 hover:bg-black/60 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:scale-100"
          aria-label="갤러리"
          title="갤러리"
        >
          {galleryPreviewUrl ? (
            <>
              <img
                src={galleryPreviewUrl}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <span className="absolute inset-0 bg-black/10" />
            </>
          ) : (
            <ImageIcon className="h-7 w-7" />
          )}
        </button>
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={handleCenterClick}
          disabled={!isRecording && isRecordDisabled}
          className={`relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full shadow-2xl transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:scale-100 ${
            canRetake && !isRecording
              ? 'bg-white text-[#111827]'
              : 'border-4 border-white/20 bg-white/10 text-white'
          }`}
          aria-label={centerButtonLabel}
          title={centerButtonLabel}
        >
          {isRecording ? (
            <span className="h-8 w-8 rounded-lg bg-[#FF4D6D]" />
          ) : canRetake ? (
            <RotateCcw className="h-9 w-9" />
          ) : (
            <span className="h-14 w-14 rounded-full bg-white" />
          )}
        </button>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSwitchCamera}
          disabled={isSwitchCameraDisabled}
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white shadow-xl backdrop-blur transition hover:scale-105 hover:bg-black/60 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:scale-100"
          aria-label="전면/후면 카메라 전환"
          title="전면/후면 카메라 전환"
        >
          <SwitchCamera className="h-7 w-7" />
        </button>
      </div>
    </div>
  );
}
