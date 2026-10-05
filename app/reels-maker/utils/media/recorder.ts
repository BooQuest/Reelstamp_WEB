import type { VideoDebugLogger } from '../../types';

const RECORDER_VIDEO_BITS_PER_SECOND = 12_000_000;

const RECORDER_AUDIO_BITS_PER_SECOND = 192_000;

const RECORDER_PREFERRED_MIME_TYPES = [
  'video/mp4;codecs=avc1.4d002a,mp4a.40.2',
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

const getSupportedRecorderMimeType = () => {
  if (typeof window === 'undefined' || !window.MediaRecorder) return null;
  return (
    RECORDER_PREFERRED_MIME_TYPES.find((type) =>
      window.MediaRecorder.isTypeSupported(type)
    ) || null
  );
};

const buildRecorderOptions = (
  mimeType: string | null,
  stream: MediaStream
): MediaRecorderOptions => {
  const options: MediaRecorderOptions = {
    videoBitsPerSecond: RECORDER_VIDEO_BITS_PER_SECOND,
  };

  if (mimeType) {
    options.mimeType = mimeType;
  }
  if (stream.getAudioTracks().length > 0) {
    options.audioBitsPerSecond = RECORDER_AUDIO_BITS_PER_SECOND;
  }

  return options;
};

export const createConfiguredRecorder = (recordingStream: MediaStream, debugLabel: string, logVideoDebug: VideoDebugLogger) => {
  if (!window.MediaRecorder) return null;

  const selectedMimeType = getSupportedRecorderMimeType();
  const options = buildRecorderOptions(selectedMimeType, recordingStream);
  const recorder = new MediaRecorder(recordingStream, options);

  logVideoDebug(`${debugLabel} recorder created`, {
    preferredMimeTypes: RECORDER_PREFERRED_MIME_TYPES,
    selectedMimeType,
    recorderMimeType: recorder.mimeType,
    requestedVideoBitsPerSecond: options.videoBitsPerSecond,
    requestedAudioBitsPerSecond: options.audioBitsPerSecond ?? null,
    recorderVideoBitsPerSecond: recorder.videoBitsPerSecond,
    recorderAudioBitsPerSecond: recorder.audioBitsPerSecond,
    audioTrackCount: recordingStream.getAudioTracks().length,
    videoTrackSettings: recordingStream
      .getVideoTracks()
      .map((track) => track.getSettings()),
  });

  return { recorder, selectedMimeType };
};
