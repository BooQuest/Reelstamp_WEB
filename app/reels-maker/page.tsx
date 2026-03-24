'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Check,
  Download,
  Music2,
  Play,
  Plus,
  RotateCcw,
  Share2,
  Sparkles,
  X,
} from 'lucide-react';
import type { WebApiResponse } from '@/app/lib/api/auth';

const EXAMPLE_ASSETS = {
  point:
    '카메라를 천천히 좌에서 우로 이동하며 매장 전체 분위기를 담아주세요. 조명이 잘 보이도록 촬영하면 더 좋아요!',
  exampleImage:
    'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80',
  exampleVideo:
    'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
} as const;

type ClipInfo = {
  blob: Blob;
  url: string;
  duration: number;
  mimeType: string;
};

type RecorderStatus = 'idle' | 'recording' | 'done';
type Stage = 'capture' | 'processing' | 'preview';

type TemplateCut = {
  order: number;
  durationSeconds: number;
  title?: string | null;
  guideText?: string | null;
  defaultCaption?: string | null;
  captureType?: string | null;
  fixedVideoUrl?: string | null;
};

type TemplateDetailResponse = {
  id: string;
  title: string;
  subtitle?: string | null;
  thumbnailUrl?: string | null;
  embedUrl?: string | null;
  tags?: string[];
  cuts: TemplateCut[];
};

export default function ReelsMakerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get('templateId');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recordTimeoutRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const recordingCutRef = useRef<number>(0);
  const recordingMimeTypeRef = useRef<string>('video/webm');

  const [stage, setStage] = useState<Stage>('capture');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [template, setTemplate] = useState<TemplateDetailResponse | null>(null);
  const [isTemplateLoading, setIsTemplateLoading] = useState(true);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [activeCutIndex, setActiveCutIndex] = useState(0);
  const [recordingStatus, setRecordingStatus] = useState<RecorderStatus>('idle');
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [clips, setClips] = useState<Array<ClipInfo | null>>([]);
  const [cutTitles, setCutTitles] = useState<string[]>([]);
  const [isExampleOpen, setIsExampleOpen] = useState(false);
  const [isReelOpen, setIsReelOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [finalVideoMimeType, setFinalVideoMimeType] = useState<string>('video/webm');
  const [finalPosterUrl, setFinalPosterUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [downloadToastMessage, setDownloadToastMessage] = useState<string | null>(null);
  const [fixedClipErrors, setFixedClipErrors] = useState<Record<number, string>>({});
  const [clipPosters, setClipPosters] = useState<Record<number, string>>({});

  const cuts = useMemo(() => {
    if (!template) return [];
    const sortedCuts = (template.cuts ?? [])
      .map((cut, index) => ({ cut, index }))
      .sort((a, b) => {
        const orderA = a.cut.order ?? a.index + 1;
        const orderB = b.cut.order ?? b.index + 1;
        if (orderA === orderB) {
          return a.index - b.index;
        }
        return orderA - orderB;
      })
      .map(({ cut }) => cut);

    return sortedCuts.map((cut, index) => {
      const duration = cut.durationSeconds ?? 0;
      const order = cut.order ?? index + 1;
      const captureType = (cut.captureType ?? 'CAPTURE').toUpperCase();
      const isFixed = captureType === 'FIXED';
      return {
        id: `${template.id}-cut-${order}`,
        order,
        durationSeconds: duration,
        label: `${duration}초`,
        guideText: cut.guideText ?? '',
        defaultCaption: cut.defaultCaption ?? cut.title ?? '',
        captureType,
        fixedVideoUrl: cut.fixedVideoUrl ?? null,
        isFixed,
      };
    });
  }, [template]);

  const activeCut = cuts[activeCutIndex] ?? null;
  const allDone = useMemo(
    () =>
      cuts.length > 0 &&
      clips.length === cuts.length &&
      clips.every((clip) => clip),
    [clips, cuts.length]
  );
  const isActiveCutFixed = activeCut?.isFixed ?? false;
  const activeFixedError = fixedClipErrors[activeCutIndex];
  const activeClip = clips[activeCutIndex] ?? null;

  useEffect(() => {
    if (!templateId) {
      router.replace('/all-templates?reason=select-template');
      return;
    }

    let isMounted = true;

    const loadTemplate = async () => {
      setIsTemplateLoading(true);
      setTemplateError(null);
      setTemplate(null);

      try {
        const response = await fetch(`/api/templates/${encodeURIComponent(templateId)}`, {
          method: 'GET',
          cache: 'no-store',
        });

        const payload: WebApiResponse<TemplateDetailResponse> = await response.json();

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || '템플릿 정보를 불러오지 못했습니다.');
        }

        const data = payload.data;
        if (!data) {
          throw new Error(payload?.message || '템플릿 정보를 불러오지 못했습니다.');
        }
        const normalized = {
          ...data,
          tags: Array.isArray(data?.tags) ? data.tags : [],
          cuts: Array.isArray(data?.cuts) ? data.cuts : [],
        };

        if (!normalized.cuts || normalized.cuts.length === 0) {
          throw new Error('템플릿 컷 정보가 없습니다.');
        }

        if (isMounted) {
          setTemplate(normalized);
        }
      } catch (error: any) {
        if (isMounted) {
          setTemplateError(error?.message || '템플릿 정보를 불러오지 못했습니다.');
        }
      } finally {
        if (isMounted) {
          setIsTemplateLoading(false);
        }
      }
    };

    loadTemplate();

    return () => {
      isMounted = false;
    };
  }, [templateId, router]);

  useEffect(() => {
    if (!template) return;

    setActiveCutIndex(0);
    setRecordingStatus('idle');
    setRemainingSeconds(null);
    setCutTitles(cuts.map((cut) => cut.defaultCaption));
    setClips((prev) => {
      prev.forEach((clip) => clip?.url && URL.revokeObjectURL(clip.url));
      return Array(cuts.length).fill(null);
    });
    setFixedClipErrors({});
    setClipPosters({});
    setFinalVideoUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return null;
    });
    setFinalPosterUrl(null);
    setFinalVideoMimeType('video/webm');
    setIsPreviewOpen(false);
  }, [template?.id, cuts]);

  useEffect(() => {
    if (cuts.length === 0) return;
    if (activeCutIndex >= cuts.length) {
      setActiveCutIndex(0);
    }
  }, [cuts.length, activeCutIndex]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  const downloadFixedClip = useCallback(
    async (url: string, durationSeconds: number): Promise<ClipInfo> => {
      const response = await fetch(`/api/templates/fixed-video?url=${encodeURIComponent(url)}`);
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.message || '고정 영상을 불러오지 못했습니다.');
      }
      const blob = await response.blob();
      const mimeType = blob.type || 'video/mp4';
      const objectUrl = URL.createObjectURL(blob);
      return {
        blob,
        url: objectUrl,
        duration: durationSeconds,
        mimeType,
      };
    },
    []
  );

  const retryFixedClip = useCallback(
    (index: number) => {
      const cut = cuts[index];
      if (!cut?.isFixed) return;
      setFixedClipErrors((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
      setClips((prev) => {
        const next = [...prev];
        if (next[index]?.url) {
          URL.revokeObjectURL(next[index]!.url);
        }
        next[index] = null;
        return next;
      });
      setClipPosters((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    },
    [cuts]
  );

  const setupCamera = useCallback(async () => {
    setCameraError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('이 브라우저에서는 카메라 기능을 사용할 수 없습니다.');
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: true,
      });
      if (mediaStream.getAudioTracks().length === 0) {
        setCameraError('마이크 접근이 필요합니다. 권한을 허용해주세요.');
        mediaStream.getTracks().forEach((track) => track.stop());
        return;
      }
      setStream(mediaStream);
    } catch (error) {
      setCameraError('카메라/마이크 접근이 거부되었어요. 권한을 확인해주세요.');
    }
  }, []);

  useEffect(() => {
    if (stage === 'capture' && template) {
      setupCamera();
    } else {
      stopCamera();
    }
  }, [stage, setupCamera, stopCamera, template]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    return () => {
      clips.forEach((clip) => clip?.url && URL.revokeObjectURL(clip.url));
    };
  }, [clips]);

  const createRecorder = () => {
    if (!stream) return null;
    if (!window.MediaRecorder) return null;

    const preferredTypes = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4;codecs=avc1.4d002a,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    const mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recordingMimeTypeRef.current = recorder.mimeType || mimeType || 'video/webm';
    return recorder;
  };

  const getSupportedMimeType = (types: string[]) => {
    if (!window.MediaRecorder) return null;
    return types.find((type) => MediaRecorder.isTypeSupported(type)) || null;
  };

  const createPosterFromClip = useCallback(async (clip: ClipInfo) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    const url = URL.createObjectURL(clip.blob);

    return new Promise<string>((resolve, reject) => {
      const cleanup = () => {
        URL.revokeObjectURL(url);
      };

      video.onloadeddata = () => {
        const width = video.videoWidth || 720;
        const height = video.videoHeight || 1280;
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
          cleanup();
          reject(new Error('포스터 생성 실패'));
          return;
        }
        canvas.width = width;
        canvas.height = height;
        context.drawImage(video, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        cleanup();
        resolve(dataUrl);
      };

      video.onerror = () => {
        cleanup();
        reject(new Error('포스터 생성 실패'));
      };

      video.src = url;
      video.load();
    });
  }, []);

  useEffect(() => {
    if (cuts.length === 0) return;

    let isCancelled = false;

    const ensureFixedClips = async () => {
      for (let index = 0; index < cuts.length; index += 1) {
        const cut = cuts[index];
        if (!cut.isFixed) continue;
        if (!cut.fixedVideoUrl) {
          setFixedClipErrors((prev) => ({
            ...prev,
            [index]: '고정 영상 URL이 없습니다.',
          }));
          continue;
        }
        if (clips[index]) continue;

        try {
          const fixedClip = await downloadFixedClip(
            cut.fixedVideoUrl,
            cut.durationSeconds ?? 0
          );
          if (isCancelled) return;

          setClips((prev) => {
            const next = [...prev];
            next[index] = fixedClip;
            return next;
          });

          try {
            const poster = await createPosterFromClip(fixedClip);
            if (!isCancelled) {
              setClipPosters((prev) => ({
                ...prev,
                [index]: poster,
              }));
            }
          } catch {
            // ignore poster failures
          }

          setFixedClipErrors((prev) => {
            const next = { ...prev };
            delete next[index];
            return next;
          });
        } catch (error: any) {
          if (isCancelled) return;
          setFixedClipErrors((prev) => ({
            ...prev,
            [index]: error?.message || '고정 영상을 불러오지 못했습니다.',
          }));
        }
      }
    };

    ensureFixedClips();

    return () => {
      isCancelled = true;
    };
  }, [clips, cuts, createPosterFromClip, downloadFixedClip]);

  const mergeClips = useCallback(async (clipInfos: ClipInfo[]) => {
    if (clipInfos.length === 1) {
      return {
        blob: clipInfos[0].blob,
        mimeType: clipInfos[0].mimeType || clipInfos[0].blob.type || 'video/webm',
      };
    }

    if (!window.MediaRecorder) {
      return {
        blob: new Blob(clipInfos.map((clip) => clip.blob), {
          type: clipInfos[0].mimeType || clipInfos[0].blob.type || 'video/webm',
        }),
        mimeType: clipInfos[0].mimeType || clipInfos[0].blob.type || 'video/webm',
      };
    }

    const video = document.createElement('video');
    video.muted = false;
    video.playsInline = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const AudioContextClass =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const audioContext = AudioContextClass ? new AudioContextClass() : null;
    let audioDestination: MediaStreamAudioDestinationNode | null = null;
    let audioSource: MediaElementAudioSourceNode | null = null;

    if (!context || !canvas.captureStream) {
      return {
        blob: new Blob(clipInfos.map((clip) => clip.blob), {
          type: clipInfos[0].mimeType || clipInfos[0].blob.type || 'video/webm',
        }),
        mimeType: clipInfos[0].mimeType || clipInfos[0].blob.type || 'video/webm',
      };
    }

    if (audioContext) {
      try {
        await audioContext.resume();
      } catch {
        // ignore
      }
      audioSource = audioContext.createMediaElementSource(video);
      audioDestination = audioContext.createMediaStreamDestination();
      audioSource.connect(audioDestination);
    }

    const loadClip = (clip: ClipInfo) =>
      new Promise<{ url: string }>((resolve, reject) => {
        const url = URL.createObjectURL(clip.blob);
        video.onloadedmetadata = () => resolve({ url });
        video.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('영상 로드 실패'));
        };
        video.src = url;
        video.load();
      });

    const firstMeta = await loadClip(clipInfos[0]);
    const width = video.videoWidth || 720;
    const height = video.videoHeight || 1280;
    canvas.width = width;
    canvas.height = height;
    context.fillStyle = '#000';
    context.fillRect(0, 0, width, height);
    URL.revokeObjectURL(firstMeta.url);

    const captureStream = canvas.captureStream(30);
    const audioTracks = audioDestination?.stream.getAudioTracks() ?? [];
    const combinedStream = new MediaStream([
      ...captureStream.getVideoTracks(),
      ...audioTracks,
    ]);

    if (captureStream.getVideoTracks().length === 0) {
      return {
        blob: new Blob(clipInfos.map((clip) => clip.blob), {
          type: clipInfos[0].mimeType || clipInfos[0].blob.type || 'video/webm',
        }),
        mimeType: clipInfos[0].mimeType || clipInfos[0].blob.type || 'video/webm',
      };
    }

    const preferredTypes = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4;codecs=avc1.4d002a,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    const mimeType = getSupportedMimeType(preferredTypes);
    const recorder = new MediaRecorder(combinedStream, mimeType ? { mimeType } : undefined);

    const chunks: BlobPart[] = [];
    const mergedBlob = await new Promise<Blob>(async (resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => reject(new Error('영상 결합 중 오류가 발생했습니다.'));

      recorder.start();

      try {
        const videoWithFrameCallback = video as HTMLVideoElement & {
          requestVideoFrameCallback?: (callback: () => void) => number;
          cancelVideoFrameCallback?: (handle: number) => void;
        };

        for (const clip of clipInfos) {
          const { url } = await loadClip(clip);
          canvas.width = video.videoWidth || width;
          canvas.height = video.videoHeight || height;
          context.fillStyle = '#000';
          context.fillRect(0, 0, canvas.width, canvas.height);

          let rafId = 0;
          let frameCallbackId = 0;
          const drawFrame = () => {
            if (!video.paused && !video.ended && video.readyState >= 2) {
              context.drawImage(video, 0, 0, canvas.width, canvas.height);
            }
            if (!video.paused && !video.ended) {
              if (videoWithFrameCallback.requestVideoFrameCallback) {
                frameCallbackId = videoWithFrameCallback.requestVideoFrameCallback(drawFrame);
              } else {
                rafId = requestAnimationFrame(drawFrame);
              }
            }
          };

          video.currentTime = 0;
          await new Promise<void>((resolve, reject) => {
            const onPlaying = () => {
              cleanup();
              resolve();
            };
            const onError = () => {
              cleanup();
              reject(new Error('영상 재생 실패'));
            };
            const cleanup = () => {
              video.removeEventListener('playing', onPlaying);
              video.removeEventListener('error', onError);
            };
            video.addEventListener('playing', onPlaying, { once: true });
            video.addEventListener('error', onError, { once: true });
            const playPromise = video.play();
            if (playPromise) {
              playPromise.catch(onError);
            }
          });
          drawFrame();
          await new Promise<void>((resolveEnded, rejectEnded) => {
            video.onended = () => resolveEnded();
            video.onerror = () => rejectEnded(new Error('영상 재생 실패'));
          });
          if (rafId) cancelAnimationFrame(rafId);
          if (frameCallbackId && videoWithFrameCallback.cancelVideoFrameCallback) {
            videoWithFrameCallback.cancelVideoFrameCallback(frameCallbackId);
          }
          URL.revokeObjectURL(url);
        }
        recorder.stop();
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || 'video/webm' }));
        };
      } catch (error) {
        recorder.stop();
        reject(error);
      }
    });

    captureStream.getTracks().forEach((track) => track.stop());
    audioDestination?.stream.getTracks().forEach((track) => track.stop());
    if (audioContext) {
      audioContext.close();
    }

    return {
      blob: mergedBlob,
      mimeType: mergedBlob.type || mimeType || 'video/webm',
    };
  }, []);

  const stopRecording = useCallback(() => {
    if (recordTimeoutRef.current) {
      window.clearTimeout(recordTimeoutRef.current);
      recordTimeoutRef.current = null;
    }
    if (countdownTimerRef.current) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setRemainingSeconds(null);

    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
  }, []);

  const startRecording = async () => {
    if (recordingStatus === 'recording') return;
    if (!activeCut) {
      setCameraError('템플릿 컷 정보를 불러오지 못했습니다.');
      return;
    }
    if (activeCut.isFixed) {
      return;
    }

    if (!stream) {
      await setupCamera();
    }
    if (!stream || stream.getAudioTracks().length === 0) {
      setCameraError('마이크 권한이 필요합니다. 설정에서 허용해주세요.');
      return;
    }

    const recorder = createRecorder();
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
      const recordedIndex = recordingCutRef.current;
      const mimeType = recorder.mimeType || recordingMimeTypeRef.current || 'video/webm';
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);

      setClips((prev) => {
        const next = [...prev];
        if (next[recordedIndex]?.url) {
          URL.revokeObjectURL(next[recordedIndex]!.url);
        }
        const recordedCut = cuts[recordedIndex];
        next[recordedIndex] = {
          blob,
          url,
          duration: recordedCut?.durationSeconds ?? activeCut.durationSeconds,
          mimeType,
        };
        return next;
      });

      setRecordingStatus('done');
      if (recordedIndex < cuts.length - 1) {
        const nextCaptureIndex = cuts.findIndex(
          (cut, index) => index > recordedIndex && !cut.isFixed
        );
        if (nextCaptureIndex !== -1) {
          setActiveCutIndex(nextCaptureIndex);
        } else {
          setActiveCutIndex(recordedIndex + 1);
        }
      }
    };

    recorder.start();
    setRecordingStatus('recording');
    setRemainingSeconds(activeCut.durationSeconds);

    const startedAt = Date.now();
    countdownTimerRef.current = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, activeCut.durationSeconds - elapsed);
      setRemainingSeconds(remaining);
    }, 500);

    recordTimeoutRef.current = window.setTimeout(() => {
      stopRecording();
    }, activeCut.durationSeconds * 1000);
  };

  const handleResetCut = () => {
    if (activeCut?.isFixed) {
      if (fixedClipErrors[activeCutIndex]) {
        setFixedClipErrors((prev) => {
          const next = { ...prev };
          delete next[activeCutIndex];
          return next;
        });
        setClips((prev) => {
          const next = [...prev];
          if (next[activeCutIndex]?.url) {
            URL.revokeObjectURL(next[activeCutIndex]!.url);
          }
          next[activeCutIndex] = null;
          return next;
        });
        setClipPosters((prev) => {
          const next = { ...prev };
          delete next[activeCutIndex];
          return next;
        });
      }
      setIsResetOpen(false);
      return;
    }
    setClips((prev) => {
      const next = [...prev];
      if (next[activeCutIndex]?.url) {
        URL.revokeObjectURL(next[activeCutIndex]!.url);
      }
      next[activeCutIndex] = null;
      return next;
    });
    setClipPosters((prev) => {
      const next = { ...prev };
      delete next[activeCutIndex];
      return next;
    });
    setRecordingStatus('idle');
    setIsResetOpen(false);
  };

  useEffect(() => {
    if (stage !== 'capture') {
      stopRecording();
      setRemainingSeconds(null);
    }
  }, [stage, stopRecording]);

  const handleComplete = async () => {
    const clipBlobs = clips.filter((clip): clip is ClipInfo => !!clip);
    if (clipBlobs.length === 0) return;

    setProcessingStep(0);
    setStage('processing');
    const timers = [
      window.setTimeout(() => setProcessingStep(1), 1200),
      window.setTimeout(() => setProcessingStep(2), 2600),
    ];

    try {
      const result = await mergeClips(clipBlobs);
      const url = URL.createObjectURL(result.blob);
      setFinalVideoMimeType(result.mimeType || 'video/webm');
      setFinalVideoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      try {
        const poster = await createPosterFromClip(clipBlobs[0]);
        setFinalPosterUrl(poster);
      } catch {
        setFinalPosterUrl(null);
      }
      setStage('preview');
    } catch (error) {
      setFinalVideoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setFinalVideoMimeType('video/webm');
      setFinalPosterUrl(null);
      setStage('capture');
      alert('영상 합치기에 실패했습니다. 다시 시도해주세요.');
    } finally {
      timers.forEach((timer) => window.clearTimeout(timer));
    }
  };

  useEffect(() => {
    if (!downloadToastMessage) return;
    const timer = window.setTimeout(() => setDownloadToastMessage(null), 2000);
    return () => window.clearTimeout(timer);
  }, [downloadToastMessage]);

  const handleTitleChange = (value: string) => {
    setCutTitles((prev) => {
      const next = [...prev];
      next[activeCutIndex] = value;
      return next;
    });
  };

  const handleDownload = () => {
    if (!finalVideoUrl) return;
    const anchor = document.createElement('a');
    anchor.href = finalVideoUrl;
    const isMp4 = finalVideoMimeType.includes('mp4');
    anchor.download = `reelstamp-reel.${isMp4 ? 'mp4' : 'webm'}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setDownloadToastMessage(isMp4 ? '다운로드 완료!' : 'MP4 미지원 브라우저로 WEBM으로 다운로드됩니다.');
  };

  const handleResetAll = () => {
    setStage('capture');
    setProcessingStep(0);
    setActiveCutIndex(0);
    setRecordingStatus('idle');
    setRemainingSeconds(null);
    setCutTitles(cuts.map((cut) => cut.defaultCaption));
    setClips((prev) => {
      const next = [...prev];
      prev.forEach((clip, index) => {
        const isFixed = cuts[index]?.isFixed;
        if (clip?.url && !isFixed) {
          URL.revokeObjectURL(clip.url);
        }
        if (!isFixed) {
          next[index] = null;
        }
      });
      return next;
    });
    setClipPosters((prev) => {
      const next = { ...prev };
      cuts.forEach((cut, index) => {
        if (!cut.isFixed) {
          delete next[index];
        }
      });
      return next;
    });
    setFixedClipErrors({});
    if (finalVideoUrl) {
      URL.revokeObjectURL(finalVideoUrl);
      setFinalVideoUrl(null);
    }
    if (finalPosterUrl) {
      setFinalPosterUrl(null);
    }
    setFinalVideoMimeType('video/webm');
    setIsPreviewOpen(false);
    setIsExampleOpen(false);
    setIsReelOpen(false);
    setIsResetOpen(false);
    setDownloadToastMessage(null);
    setupCamera();
  };

  if (!templateId) {
    return (
      <div className="min-h-[calc(100vh-80px)] bg-black text-white flex items-center justify-center px-4">
        <div className="max-w-sm text-center text-sm text-white/70">
          템플릿 선택 화면으로 이동 중입니다...
        </div>
      </div>
    );
  }

  if (isTemplateLoading) {
    return (
      <div className="min-h-[calc(100vh-80px)] bg-black text-white flex items-center justify-center px-4">
        <div className="max-w-sm text-center text-sm text-white/70">
          템플릿 정보를 불러오는 중입니다...
        </div>
      </div>
    );
  }

  if (templateError || !template || cuts.length === 0) {
    return (
      <div className="min-h-[calc(100vh-80px)] bg-black text-white flex items-center justify-center px-4">
        <div className="max-w-sm text-center space-y-4">
          <p className="text-sm text-white/70">
            {templateError || '템플릿 정보를 불러오지 못했습니다.'}
          </p>
          <button
            type="button"
            onClick={() => router.replace('/all-templates')}
            className="rounded-full bg-[#FF4D6D] px-4 py-2 text-sm font-semibold shadow-lg"
          >
            템플릿 다시 선택하기
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'processing') {
    return (
      <div className="min-h-[calc(100vh-80px)] bg-black text-white flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="w-24 h-24 rounded-full border-4 border-white/10 border-t-[#FF4D6D] animate-spin mx-auto" />
          <div>
            <h1 className="text-2xl font-bold mb-2">릴스를 만들고 있어요</h1>
            <p className="text-sm text-white/60">
              BGM 삽입, 컷 전환 효과, 보정 적용 중...
            </p>
          </div>
          <div className="space-y-3 text-left">
            {[
              { label: '영상 편집 완료', done: processingStep >= 1 },
              { label: '자막 배치 완료', done: processingStep >= 2 },
              { label: 'BGM 삽입 중...', done: false },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-3 text-sm font-medium"
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                    item.done ? 'border-emerald-400 text-emerald-400' : 'border-white/30'
                  }`}
                >
                  {item.done ? <Check className="w-3 h-3" /> : null}
                </div>
                <span className={item.done ? 'text-emerald-300' : 'text-white/70'}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'preview') {
    return (
      <div className="min-h-[calc(100vh-80px)] bg-black text-white">
        <div className="max-w-md mx-auto px-4 pt-6 pb-10 space-y-6">
          <h1 className="text-center text-lg font-semibold">최종 미리보기</h1>

          <div className="rounded-[28px] bg-[#1E2A3B] p-4 shadow-2xl space-y-4">
            <div className="relative rounded-[24px] overflow-hidden">
              <div className="aspect-[9/16] bg-black flex items-center justify-center">
                {finalVideoUrl ? (
                  <video
                    src={finalVideoUrl}
                    muted
                    playsInline
                    preload="metadata"
                    poster={finalPosterUrl || undefined}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={EXAMPLE_ASSETS.exampleImage}
                    alt="미리보기"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(true)}
                  disabled={!finalVideoUrl}
                  className="w-16 h-16 rounded-full bg-white/70 flex items-center justify-center backdrop-blur shadow-lg"
                >
                  <Play className="w-8 h-8 text-white" />
                </button>
              </div>
              {downloadToastMessage && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold flex items-center gap-2 shadow-lg">
                  <Check className="w-4 h-4" />
                  {downloadToastMessage}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-xs font-semibold text-white/80">
              <Music2 className="w-4 h-4" />
              Trending BGM - Summer Vibes
            </div>
          </div>

          <div className="rounded-[24px] bg-[#121A2A] p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Sparkles className="w-5 h-5 text-[#FF4D6D]" />
              자동 적용된 효과
            </div>
            {[
              '트렌디 BGM',
              '컷 전환 효과',
              '자동 색보정',
              '자막 애니메이션',
            ].map((label) => (
              <div key={label} className="flex items-center justify-between text-sm text-white/80">
                <span>{label}</span>
                <span className="text-[#FF4D6D] font-semibold">적용됨</span>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <button
              type="button"
              className="w-full rounded-full bg-[#FF4D6D] py-4 text-base font-semibold shadow-lg flex items-center justify-center gap-2"
            >
              <Share2 className="w-5 h-5" />
              인스타그램에 공유
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!finalVideoUrl}
              className="w-full rounded-full bg-[#2B3446] py-4 text-base font-semibold shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Download className="w-5 h-5" />
              영상 다운로드
            </button>
            <button
              type="button"
              onClick={handleResetAll}
              className="w-full rounded-full bg-[#3B4557] py-4 text-base font-semibold shadow-lg"
            >
              새로운 릴스 만들기
            </button>
          </div>
        </div>

        {isPreviewOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
            <button
              type="button"
              onClick={() => setIsPreviewOpen(false)}
              className="absolute top-6 right-6 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-full max-w-sm">
              <div className="rounded-[28px] overflow-hidden bg-black">
                {finalVideoUrl ? (
                  <video
                    src={finalVideoUrl}
                    controls
                    poster={finalPosterUrl || undefined}
                    className="w-full h-[70vh] object-cover"
                  />
                ) : (
                  <div className="w-full h-[70vh] flex items-center justify-center text-white/70 text-sm">
                    영상 준비 중...
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-80px)] bg-black text-white">
      <div className="max-w-md mx-auto px-4 pt-6 pb-10">
        <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
          모바일 웹앱에서 촬영하면 더 안정적으로 카메라를 사용할 수 있어요.
        </div>

        <div className="relative rounded-[28px] bg-[#1E2A3B] px-4 pt-5 pb-6 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-white/80">
              {recordingStatus === 'recording' ? (
                <div className="flex items-center gap-2 rounded-full bg-[#FF4D6D] px-3 py-1 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-white" />
                  REC
                </div>
              ) : (
                <span className="text-xs text-white/50">릴스 제작</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsExampleOpen(true)}
              className="rounded-full bg-[#FF4D6D] px-4 py-2 text-xs font-semibold shadow-lg"
            >
              예시 보기
            </button>
          </div>

          <div className="mb-4">
            <input
              value={cutTitles[activeCutIndex] ?? ''}
              onChange={(event) => handleTitleChange(event.target.value)}
              className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-center text-base font-semibold text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#FF4D6D]"
            />
          </div>

          <p className="text-sm text-[#58C4FF] text-center mb-5">
            {activeCut?.guideText || '안내 문구가 준비되지 않았습니다.'}
          </p>

          {isActiveCutFixed && (
            <p className="text-xs text-center text-white/50 mb-5">
              고정 영상 컷입니다. 촬영 없이 자동으로 완료됩니다.
            </p>
          )}

          <div className="relative h-[360px] rounded-[24px] bg-[#243246] flex items-center justify-center overflow-hidden">
            {isActiveCutFixed ? (
              activeFixedError ? (
                <div className="text-sm text-white/70 text-center px-6 space-y-3">
                  <p>{activeFixedError}</p>
                  <button
                    type="button"
                    onClick={() => retryFixedClip(activeCutIndex)}
                    className="rounded-full bg-white/10 px-4 py-2 text-xs text-white/80"
                  >
                    다시 불러오기
                  </button>
                </div>
              ) : activeClip ? (
                <video
                  src={activeClip.url}
                  muted
                  playsInline
                  preload="metadata"
                  poster={clipPosters[activeCutIndex] || undefined}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="text-sm text-white/70 text-center px-6">
                  고정 영상을 불러오는 중입니다...
                </div>
              )
            ) : cameraError ? (
              <div className="text-sm text-white/70 text-center px-6">
                {cameraError}
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/30" />
                <div className="relative text-center text-white/40">
                  <div className="w-16 h-16 rounded-full border border-white/20 flex items-center justify-center mx-auto mb-3">
                    <span className="text-sm">📷</span>
                  </div>
                  카메라 뷰
                </div>
              </>
            )}
          </div>

          <div className="mt-6 flex items-center justify-center gap-3">
            {cuts.map((cut, index) => {
              const clip = clips[index];
              const isActive = index === activeCutIndex;
              return (
                <button
                  key={cut.id}
                  type="button"
                  onClick={() => {
                    if (fixedClipErrors[index]) {
                      retryFixedClip(index);
                      return;
                    }
                    if (recordingStatus === 'recording') return;
                    setActiveCutIndex(index);
                  }}
                  className={`relative flex flex-col items-center justify-center w-20 h-24 rounded-2xl border-2 transition-all ${
                    isActive ? 'border-[#FF4D6D] bg-white/10' : 'border-white/10 bg-white/5'
                  }`}
                >
                  {clip ? (
                    <video
                      src={clip.url}
                      muted
                      playsInline
                      preload="metadata"
                      poster={clipPosters[index] || undefined}
                      className="absolute inset-0 h-full w-full object-cover rounded-2xl"
                    />
                  ) : (
                    <Plus className="w-6 h-6 text-white/40" />
                  )}
                  <span className="absolute bottom-2 text-xs text-white/70">{cut.label}</span>
                  {clip && (
                    <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                  {cut.isFixed && !clip && !fixedClipErrors[index] && (
                    <span className="absolute top-2 left-2 rounded-full bg-white/20 px-2 py-0.5 text-[10px] text-white/70">
                      고정
                    </span>
                  )}
                  {fixedClipErrors[index] && (
                    <span className="absolute top-2 left-2 rounded-full bg-rose-500/80 px-2 py-0.5 text-[10px] text-white">
                      오류
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex items-center justify-center">
            {allDone ? (
              <button
                type="button"
                onClick={handleComplete}
                className="w-full rounded-full bg-[#FF4D6D] py-4 text-base font-semibold shadow-lg"
              >
                ✓ 완료하기
              </button>
            ) : (
              <button
                type="button"
                onClick={recordingStatus === 'recording' ? stopRecording : startRecording}
                disabled={isActiveCutFixed}
                className={`relative w-20 h-20 rounded-full border-4 flex items-center justify-center shadow-2xl ${
                  isActiveCutFixed
                    ? 'border-white/20 cursor-not-allowed'
                    : 'border-[#FF4D6D]'
                }`}
              >
                <span
                  className={`transition-all ${
                    recordingStatus === 'recording'
                      ? 'w-8 h-8 rounded-lg bg-[#FF4D6D]'
                      : 'w-12 h-12 rounded-full bg-white'
                  }`}
                />
              </button>
            )}
          </div>

          {remainingSeconds !== null && (
            <div className="mt-3 text-center text-sm text-white/70">
              {remainingSeconds}s 남음
            </div>
          )}
        </div>

        {allDone && (
          <div className="mt-6 flex flex-col items-center gap-5">
            <div className="flex items-center gap-3">
              {clips.map((clip, index) => (
                <div
                  key={`thumb-${cuts[index]?.id ?? index}`}
                  className="relative w-16 h-20 rounded-xl overflow-hidden border-2 border-emerald-400"
                >
                  {clip && (
                    <video
                      src={clip.url}
                      muted
                      playsInline
                      preload="metadata"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                  <span className="absolute bottom-1 left-0 right-0 text-center text-[10px] text-white/80">
                    {cuts[index]?.label ?? ''}
                  </span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setIsResetOpen(true)}
              className="w-16 h-16 rounded-full border-2 border-white/30 flex items-center justify-center text-white/70"
            >
              <RotateCcw className="w-6 h-6" />
            </button>
          </div>
        )}
      </div>

      {isExampleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-[28px] bg-[#1E2A3B] overflow-hidden relative">
            <button
              type="button"
              onClick={() => setIsExampleOpen(false)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="h-64 bg-black">
              <img
                src={EXAMPLE_ASSETS.exampleImage}
                alt="예시 이미지"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="p-5 space-y-4">
              <button
                type="button"
                onClick={() => {
                  setIsExampleOpen(false);
                  setIsReelOpen(true);
                }}
                className="w-full rounded-full bg-[#FF4D6D] py-3 text-sm font-semibold"
              >
                실제 릴스 보기
              </button>
              <div>
                <p className="text-sm font-semibold text-white/80 mb-2">이 컷의 포인트</p>
                <p className="text-xs text-white/60 leading-relaxed">{EXAMPLE_ASSETS.point}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {isReelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <button
            type="button"
            onClick={() => setIsReelOpen(false)}
            className="absolute top-6 right-6 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-full max-w-sm">
            <div className="rounded-[28px] overflow-hidden bg-black">
              <video
                src={EXAMPLE_ASSETS.exampleVideo}
                controls
                className="w-full h-[70vh] object-cover"
              />
            </div>
          </div>
        </div>
      )}

      {isResetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-[24px] bg-[#1E2A3B] p-6 text-white">
            <h3 className="text-lg font-semibold mb-2">촬영 재시도</h3>
            <p className="text-sm text-white/70 mb-5">
              촬영한 영상을 다시 찍으시겠어요? 현재 영상은 삭제됩니다.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsResetOpen(false)}
                className="flex-1 rounded-xl bg-white/10 py-2 text-sm"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleResetCut}
                className="flex-1 rounded-xl bg-[#FF4D6D] py-2 text-sm font-semibold"
              >
                다시 찍기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
