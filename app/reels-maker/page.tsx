'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent as ReactChangeEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  Camera,
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  Menu,
  Plus,
  RotateCcw,
  SwitchCamera,
  Trash2,
} from 'lucide-react';
import type { WebApiResponse } from '@/app/lib/api/auth';
import { useAuth } from '@/app/components/providers/AuthProvider';
import { USER_ROLES } from '@/app/lib/constants/auth';
import CaptureMenu from '@/app/reels-maker/components/CaptureMenu';
import AutoCaptionEditor from '@/app/reels-maker/components/AutoCaptionEditor';
import CameraPreviewVideo from '@/app/reels-maker/components/CameraPreviewVideo';
import CaptionOverlayStage from '@/app/reels-maker/components/CaptionOverlayStage';
import CapturedClipPreview from '@/app/reels-maker/components/CapturedClipPreview';
import CutMediaSourceModal from '@/app/reels-maker/components/CutMediaSourceModal';
import ExitConfirmModal from '@/app/reels-maker/components/ExitConfirmModal';
import FinalPreview from '@/app/reels-maker/components/FinalPreview';
import FixedClipVideo from '@/app/reels-maker/components/FixedClipVideo';
import FullScreenState from '@/app/reels-maker/components/FullScreenState';
import GuestDraftNotice from '@/app/reels-maker/components/GuestDraftNotice';
import ProcessingView from '@/app/reels-maker/components/ProcessingView';
import ResetCutModal from '@/app/reels-maker/components/ResetCutModal';
import RetakeConfirmModal from '@/app/reels-maker/components/RetakeConfirmModal';
import TemplateGuideModal, {
  type TemplateGuideStep,
} from '@/app/reels-maker/components/TemplateGuideModal';
import TrimModal from '@/app/reels-maker/components/TrimModal';
import useCaptionEditor from '@/app/reels-maker/hooks/useCaptionEditor';
import useAutoCaption from '@/app/reels-maker/hooks/useAutoCaption';
import useDraftAutosave from '@/app/reels-maker/hooks/useDraftAutosave';
import {
  AUTO_CAPTION_DEFAULT_STYLE,
  COMPLETE_START_FAILED_USER_MESSAGE,
  DEFAULT_CAPTION_STYLE,
  DEFAULT_GALLERY_CLIP_DURATION_SECONDS,
  DURATION_MODE_FORCED,
  DURATION_MODE_RECOMMENDED,
  MAX_CAPTIONS_PER_CLIP,
  MIN_TRIM_DURATION_SECONDS,
  PROCESSING_FAILED_USER_MESSAGE,
  PROCESSING_STATUS_TIMEOUT_MS,
  PROCESSING_TIMEOUT_USER_MESSAGE,
  RECOMMENDED_AUTO_STOP_SECONDS,
  TIMELINE_THUMBNAIL_COUNT,
} from '@/app/reels-maker/constants';
import type {
  CameraFacingMode,
  CaptionItem,
  ClipInfo,
  RecorderStatus,
  ReelsMakerClipPresignResponse,
  ReelsMakerErrorResponse,
  ReelsMakerSessionResponse,
  ReelsMakerStatusResponse,
  Stage,
  TemplateDetailResponse,
  TemplateExampleReel,
  TrimDragMode,
  TrimDragStartState,
  VideoMetadata,
} from '@/app/reels-maker/types';
import {
  parseGuideImageEntries,
} from '@/app/reels-maker/utils/assets';
import {
  buildCaptionExportStyle,
  clampValue,
  normalizeCaptionStyle,
} from '@/app/reels-maker/utils/captions';
import {
  buildCameraEnhancementConstraints,
  buildCameraMediaConstraintCandidates,
  buildFallbackCameraMediaConstraints,
  isPortraitMediaTrackSettings,
  selectPreferredRearCameraDevice,
  type CameraPreviewMetrics,
} from '@/app/reels-maker/utils/camera';
import { getErrorMessage } from '@/app/reels-maker/utils/errors';
import {
  buildTemplateLoginHref,
  PAID_TEMPLATE_REQUIRED_ERROR_CODE,
  TEMPLATE_LOGIN_REQUIRED_ERROR_CODE,
  TEMPLATE_LOGIN_REQUIRED_MESSAGE,
  TEMPLATE_PAYMENT_PATH,
} from '@/app/lib/templates/access';

const DEFAULT_COMPLETION_RETURN_URL = '/templates';

const normalizeCompletionReturnUrl = (value: string | null): string => {
  if (!value) return DEFAULT_COMPLETION_RETURN_URL;

  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return DEFAULT_COMPLETION_RETURN_URL;
  }
  if (trimmed.startsWith('/login') || trimmed.startsWith('/reels-maker')) {
    return DEFAULT_COMPLETION_RETURN_URL;
  }

  return trimmed;
};

const buildReelsMakerHref = ({
  templateId,
  sessionId,
  returnUrl,
}: {
  templateId: string;
  sessionId?: number | string | null;
  returnUrl?: string | null;
}) => {
  const params = new URLSearchParams({ templateId });
  if (sessionId) {
    params.set('sessionId', String(sessionId));
  }
  if (returnUrl) {
    params.set('returnUrl', returnUrl);
  }

  return `/reels-maker?${params.toString()}`;
};

type FilePickerAcceptOption = {
  description?: string;
  accept: Record<string, string[]>;
};

type FileSystemFileHandleLike = {
  getFile: () => Promise<File>;
};

type WindowWithOpenFilePicker = Window & {
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    excludeAcceptAllOption?: boolean;
    types?: FilePickerAcceptOption[];
  }) => Promise<FileSystemFileHandleLike[]>;
};

type ClipSource = 'recording' | 'file';

type ReplacementConfirmState =
  | {
      type: 'recording' | 'gallery';
      cutIndex: number;
    }
  | null;

const GALLERY_FILE_PICKER_TYPES: FilePickerAcceptOption[] = [
  {
    description: '사진 또는 영상',
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.heic'],
      'video/*': ['.mp4', '.mov', '.webm', '.m4v'],
    },
  },
];

type SessionErrorState = {
  type: 'auth' | 'template-login' | 'paid-template' | 'generic';
  message: string;
  status?: number;
  errorCode?: string | null;
};

const SESSION_AUTH_EXPIRED_MESSAGE =
  '로그인이 만료되어 릴스 제작을 시작할 수 없어요. 다시 로그인한 뒤 이어서 진행해 주세요.';

const SESSION_AUTH_ERROR_CODES = new Set([
  'INVALID_TOKEN',
  'INVALID_TOKEN_SUBJECT',
  'TOKEN_EXPIRED',
  'MISSING_AUTH_TOKEN',
]);

const getSessionFallbackMessage = (requestedSessionId: string | null) =>
  requestedSessionId
    ? '저장된 프로젝트를 불러오지 못했습니다.'
    : '릴스 제작 세션을 생성하지 못했습니다.';

const isSessionAuthError = (
  status?: number,
  errorCode?: string | null
): boolean => {
  if (status === 401) return true;
  if (!errorCode) return false;

  return SESSION_AUTH_ERROR_CODES.has(errorCode.trim().toUpperCase());
};

const buildSessionErrorState = ({
  status,
  errorCode,
  message,
  fallbackMessage,
}: {
  status?: number;
  errorCode?: string | null;
  message?: string | null;
  fallbackMessage: string;
}): SessionErrorState => {
  if (errorCode === TEMPLATE_LOGIN_REQUIRED_ERROR_CODE) {
    return {
      type: 'template-login',
      status,
      errorCode,
      message: TEMPLATE_LOGIN_REQUIRED_MESSAGE,
    };
  }
  if (errorCode === PAID_TEMPLATE_REQUIRED_ERROR_CODE) {
    return {
      type: 'paid-template',
      status,
      errorCode,
      message: message?.trim() || '유료 템플릿은 결제 후 이용할 수 있습니다.',
    };
  }

  const type = isSessionAuthError(status, errorCode) ? 'auth' : 'generic';
  return {
    type,
    status,
    errorCode,
    message:
      type === 'auth'
        ? SESSION_AUTH_EXPIRED_MESSAGE
        : message?.trim() || fallbackMessage,
  };
};

const normalizeSessionCaptions = (
  rawCaptions: CaptionItem[] | undefined
): CaptionItem[] => {
  return (rawCaptions ?? []).map((caption) => {
    const source = caption.source ?? 'USER';
    const role = source === 'AUTO' ? 'SPEECH' : 'OVERLAY';
    return {
      ...caption,
      source,
      role,
      style: normalizeCaptionStyle(
        source === 'AUTO'
          ? { ...AUTO_CAPTION_DEFAULT_STYLE, ...(caption.style ?? {}) }
          : { ...DEFAULT_CAPTION_STYLE, ...(caption.style ?? {}) }
      ),
    };
  });
};

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

const isValidMediaDimension = (value: number) =>
  Number.isFinite(value) && value > 0;

const isValidMediaSize = (width: number, height: number) =>
  isValidMediaDimension(width) && isValidMediaDimension(height);

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

function ReelsMakerInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, setUser, user } = useAuth();
  const templateId = searchParams.get('templateId');
  const requestedSessionId = searchParams.get('sessionId');
  const returnUrlParam = searchParams.get('returnUrl');
  const isVideoDebugEnabled = searchParams.get('videoDebug') === '1';
  const completionReturnUrl = useMemo(
    () => normalizeCompletionReturnUrl(returnUrlParam),
    [returnUrlParam]
  );
  const explicitCompletionReturnUrl = returnUrlParam ? completionReturnUrl : null;
  const cameraFrameRef = useRef<HTMLDivElement | null>(null);
  const galleryFileInputRef = useRef<HTMLInputElement | null>(null);
  const trimPreviewVideoRef = useRef<HTMLVideoElement | null>(null);
  const trimViewportRef = useRef<HTMLDivElement | null>(null);
  const trimMeasureRef = useRef<HTMLDivElement | null>(null);
  const trimPreviewContainerRef = useRef<HTMLDivElement | null>(null);
  const trimTimelineRef = useRef<HTMLDivElement | null>(null);
  const trimPlaybackRafRef = useRef<number | null>(null);
  const trimDragPointerIdRef = useRef<number | null>(null);
  const trimDragStartRef = useRef<TrimDragStartState | null>(null);
  const trimBoundsRef = useRef({ start: 0, end: 0, scrub: 0 });
  const captureViewportRef = useRef<HTMLDivElement | null>(null);
  const captureContentRef = useRef<HTMLDivElement | null>(null);
  const captureMeasureRef = useRef<HTMLDivElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recordTimeoutRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const recordingCutRef = useRef<number>(0);
  const recordingShouldAdvanceRef = useRef(true);
  const recordingMimeTypeRef = useRef<string>('video/webm');
  const cameraSetupInProgressRef = useRef(false);
  const switchCameraInProgressRef = useRef(false);
  const latestClipsRef = useRef<Array<ClipInfo | null>>([]);
  const uploadedCutsRef = useRef<Record<number, boolean>>({});
  const mediaPickerTargetIndexRef = useRef<number | null>(null);
  const mediaPickerFocusTimeoutRef = useRef<number | null>(null);
  const sessionHydratedRef = useRef(false);
  const sessionInitKeyRef = useRef<string | null>(null);

  const [stage, setStage] = useState<Stage>('capture');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [template, setTemplate] = useState<TemplateDetailResponse | null>(null);
  const [isTemplateLoading, setIsTemplateLoading] = useState(true);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessionClipMap, setSessionClipMap] = useState<Record<number, number>>({});
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<SessionErrorState | null>(null);
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false);
  const [pendingExitHref, setPendingExitHref] = useState('/my-projects');
  const [isExitSaving, setIsExitSaving] = useState(false);
  const [showGuestDraftNotice, setShowGuestDraftNotice] = useState(false);
  const [uploadedCuts, setUploadedCuts] = useState<Record<number, boolean>>({});
  const [uploadingCuts, setUploadingCuts] = useState<Record<number, boolean>>({});
  const [clipUploadErrors, setClipUploadErrors] = useState<Record<number, string>>({});
  const [activeCutIndex, setActiveCutIndex] = useState(0);
  const [recordingStatus, setRecordingStatus] = useState<RecorderStatus>('idle');
  const [recordingElapsedSeconds, setRecordingElapsedSeconds] = useState<number | null>(null);
  const [clips, setClips] = useState<Array<ClipInfo | null>>([]);
  const [clipSources, setClipSources] = useState<Record<number, ClipSource>>({});
  const [captions, setCaptions] = useState<CaptionItem[]>([]);
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [autoCaptionAvailable, setAutoCaptionAvailable] = useState(false);
  const [autoCaptionRemainingAttempts, setAutoCaptionRemainingAttempts] =
    useState(0);
  const [activeAutoCaptionJobId, setActiveAutoCaptionJobId] = useState<
    string | null
  >(null);
  const [latestAutoCaptionJobId, setLatestAutoCaptionJobId] = useState<
    string | null
  >(null);
  const [staleAutoCaptionClipIds, setStaleAutoCaptionClipIds] = useState<
    number[]
  >([]);
  const [acceptedStaleAutoCaptionClipIds, setAcceptedStaleAutoCaptionClipIds] =
    useState<number[]>([]);
  const [cutGuideVisibility, setCutGuideVisibility] = useState<Record<number, boolean>>({});
  const [guideImageIndexByCut, setGuideImageIndexByCut] = useState<Record<number, number>>({});
  const [isTemplateGuideOpen, setIsTemplateGuideOpen] = useState(false);
  const [templateGuideStep, setTemplateGuideStep] =
    useState<TemplateGuideStep>('overview');
  const [exampleReelIndex, setExampleReelIndex] = useState(0);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [finalVideoMimeType, setFinalVideoMimeType] = useState<string>('video/mp4');
  const [finalPosterUrl, setFinalPosterUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [downloadToastMessage, setDownloadToastMessage] = useState<string | null>(null);
  const [fixedClipErrors, setFixedClipErrors] = useState<Record<number, string>>({});
  const [clipPosters, setClipPosters] = useState<Record<number, string>>({});
  const [cameraFacingMode, setCameraFacingMode] = useState<CameraFacingMode>('environment');
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [isGalleryProcessing, setIsGalleryProcessing] = useState(false);
  const [isMediaSourceOpen, setIsMediaSourceOpen] = useState(false);
  const [isMediaPickerActive, setIsMediaPickerActive] = useState(false);
  const [mediaPickerTargetCutIndex, setMediaPickerTargetCutIndex] = useState<number | null>(
    null
  );
  const [trimTargetCutIndex, setTrimTargetCutIndex] = useState<number | null>(null);
  const [replacementConfirm, setReplacementConfirm] =
    useState<ReplacementConfirmState>(null);
  const [isTrimOpen, setIsTrimOpen] = useState(false);
  const [trimSourceFile, setTrimSourceFile] = useState<File | null>(null);
  const [trimSourceUrl, setTrimSourceUrl] = useState<string | null>(null);
  const [trimSourceMetadata, setTrimSourceMetadata] = useState<VideoMetadata | null>(null);
  const [trimStartSeconds, setTrimStartSeconds] = useState(0);
  const [trimEndSeconds, setTrimEndSeconds] = useState(0);
  const [trimScrubSeconds, setTrimScrubSeconds] = useState(0);
  const [isTrimPlaying, setIsTrimPlaying] = useState(false);
  const [activeTrimDrag, setActiveTrimDrag] = useState<TrimDragMode>('none');
  const [trimPreviewMaxHeight, setTrimPreviewMaxHeight] = useState<number | null>(null);
  const [trimThumbnails, setTrimThumbnails] = useState<string[]>([]);
  const [isTrimPreparing, setIsTrimPreparing] = useState(false);
  const [trimError, setTrimError] = useState<string | null>(null);
  const [captureScale, setCaptureScale] = useState(1);
  const [isCaptureMenuOpen, setIsCaptureMenuOpen] = useState(false);

  const isAdmin = user?.role?.toUpperCase() === USER_ROLES.ADMIN;
  const isGuestUser = Boolean(user?.guest || user?.provider === 'GUEST');
  const isRegisteredUser = Boolean(isAuthenticated && user && !isGuestUser);
  const currentReelsMakerHref = templateId
    ? buildReelsMakerHref({
        templateId,
        sessionId: sessionId ?? requestedSessionId,
        returnUrl: explicitCompletionReturnUrl,
      })
    : '/reels-maker';
  const buildLoginHref = useCallback(
    (href: string) => `/login?returnUrl=${encodeURIComponent(href)}`,
    []
  );
  const logVideoDebug = useCallback(
    (event: string, details?: unknown) => {
      if (!isVideoDebugEnabled) return;
      console.info(`[ReelsMaker videoDebug] ${event}`, details);
    },
    [isVideoDebugEnabled]
  );
  const handleCameraPreviewMetrics = useCallback(
    (metrics: CameraPreviewMetrics) => {
      logVideoDebug('camera preview metrics', metrics);
    },
    [logVideoDebug]
  );

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
      const durationMode =
        (cut.durationMode ?? '').trim().toUpperCase() === DURATION_MODE_FORCED
          ? DURATION_MODE_FORCED
          : DURATION_MODE_RECOMMENDED;
      return {
        id: `${template.id}-cut-${order}`,
        order,
        durationSeconds: duration,
        durationMode: isFixed ? null : durationMode,
        label: isFixed
          ? `${duration}초`
          : `${duration}초 [${durationMode === DURATION_MODE_FORCED ? '강제' : '권장'}]`,
        guideText: cut.guideText ?? cut['guide_text'] ?? '',
        guideImageUrl: cut.guideImageUrl ?? cut['guide_image_url'] ?? null,
        exampleImageUrl: cut.exampleImageUrl ?? null,
        exampleVideoUrl: cut.exampleVideoUrl ?? null,
        defaultCaption: cut.defaultCaption ?? '',
        captureType,
        fixedVideoUrl: cut.fixedVideoUrl ?? null,
        fixedPreviewImageUrl: cut.fixedPreviewImageUrl ?? null,
        isFixed,
      };
    });
  }, [template]);

  const {
    projectName,
    setProjectName,
    draftSaveStatus,
    lastSavedAt,
    captionsRef,
    saveDraftNow,
    hydrateDraft,
    resetDraft,
    applyServerUpdate,
    cancelScheduledSave,
    resumeAutosave,
    suspendAutosave,
  } = useDraftAutosave({
    cuts,
    captions,
    captionsEnabled,
    activeCutIndex,
    isRegisteredUser,
    sessionId,
    stage,
    isExitConfirmOpen,
    sessionHydratedRef,
  });

  const activeCut = cuts[activeCutIndex] ?? null;
  const allDone = useMemo(() => {
    if (cuts.length === 0) return false;
    if (!sessionId) return false;
    return cuts.every((cut, index) => {
      if (cut.isFixed) {
        return Boolean(clips[index]) && !fixedClipErrors[index];
      }
      return uploadedCuts[index];
    });
  }, [clips, cuts, fixedClipErrors, sessionId, uploadedCuts]);
  const isActiveCutFixed = activeCut?.isFixed ?? false;
  const activeFixedError = fixedClipErrors[activeCutIndex];
  const activeUploadError = clipUploadErrors[activeCutIndex];
  const isUploadingActiveCut = uploadingCuts[activeCutIndex];
  const activeClip = clips[activeCutIndex] ?? null;
  const shouldShowActiveClipPreview =
    !isActiveCutFixed && Boolean(activeClip) && recordingStatus !== 'recording';
  const activeClipId = activeCut ? sessionClipMap[activeCut.order] ?? null : null;
  const activeClipSource = clipSources[activeCutIndex] ?? null;
  const shouldConfirmActiveRetake = activeClipSource === 'recording';
  const showCaptionStage =
    captionsEnabled &&
    !activeUploadError &&
    !activeFixedError &&
    (!cameraError || Boolean(activeClip)) &&
    (!isActiveCutFixed || Boolean(activeClip));
  const {
    captionStageRef,
    captionOverlayRef,
    captionInputRef,
    captionPreviewScale,
    setSelectedCaptionId,
    editingCaptionId,
    setEditingCaptionId,
    activeCaptions,
    resolvedSelectedCaptionId,
    activeCaptionStyle,
    showCaptionOverlay,
    resetCaptionGesture,
    handleCameraFrameRef,
    addCaptionToActiveClip,
    deleteSelectedCaption,
    handleCaptionPointerMove,
    handleCaptionPointerEnd,
    handleCaptionPointerDown,
    handleResizeHandlePointerMove,
    handleResizeHandlePointerEnd,
    handleResizeHandlePointerDown,
    handleCaptionTextChange,
    handleCaptionToggleBox,
  } = useCaptionEditor({
    activeClipId,
    showCaptionStage,
    stage,
    captions,
    setCaptions,
    captionsRef,
    cameraFrameRef,
  });
  const activeOverlayCaptionCount = activeCaptions.filter(
    (caption) => caption.source !== 'AUTO'
  ).length;
  const applyCaptionSessionSnapshot = useCallback(
    (session: ReelsMakerSessionResponse) => {
      const nextCaptions = normalizeSessionCaptions(session.captionItems);
      setCaptions(nextCaptions);
      setCaptionsEnabled(session.captionsEnabled !== false);
      setAutoCaptionAvailable(Boolean(session.autoCaptionAvailable));
      setAutoCaptionRemainingAttempts(
        session.autoCaptionRemainingAttempts ?? 0
      );
      setActiveAutoCaptionJobId(session.activeAutoCaptionJobId ?? null);
      setLatestAutoCaptionJobId(session.latestAutoCaptionJobId ?? null);
      setStaleAutoCaptionClipIds(session.staleAutoCaptionClipIds ?? []);
      setAcceptedStaleAutoCaptionClipIds((current) =>
        current.filter((clipId) =>
          (session.staleAutoCaptionClipIds ?? []).includes(clipId)
        )
      );
      applyServerUpdate(session);
    },
    [applyServerUpdate]
  );
  const {
    job: autoCaptionJob,
    error: autoCaptionError,
    isProcessing: isAutoCaptionProcessing,
    start: startAutoCaption,
  } = useAutoCaption({
    sessionId,
    initialJobId: activeAutoCaptionJobId ?? latestAutoCaptionJobId,
    onSessionReloaded: applyCaptionSessionSnapshot,
  });
  const isMediaImportBlocked =
    isSessionLoading ||
    !sessionId ||
    recordingStatus === 'recording' ||
    isGalleryProcessing ||
    isTrimPreparing ||
    isTrimOpen ||
    isMediaPickerActive;
  const isRecordDisabled =
    isActiveCutFixed ||
    isUploadingActiveCut ||
    isSessionLoading ||
    !sessionId ||
    isGalleryProcessing ||
    isTrimPreparing ||
    isTrimOpen ||
    isMediaPickerActive;
  const isSwitchCameraDisabled =
    recordingStatus === 'recording' ||
    isActiveCutFixed ||
    isGalleryProcessing ||
    isTrimPreparing ||
    isTrimOpen ||
    isMediaPickerActive;
  const isCaptureCameraPaused =
    !sessionId ||
    isSessionLoading ||
    isTemplateGuideOpen ||
    isMediaPickerActive ||
    isGalleryProcessing ||
    isTrimPreparing ||
    isTrimOpen;
  const guideImageEntries = useMemo(
    () => parseGuideImageEntries(activeCut?.guideImageUrl),
    [activeCut?.guideImageUrl]
  );
  const guideImageCount = guideImageEntries.length;
  const hasTimedGuideImages = guideImageEntries.some((entry) => entry.startSecond !== null);
  const manualGuideImageIndex = Math.min(
    guideImageIndexByCut[activeCutIndex] ?? 0,
    Math.max(0, guideImageCount - 1)
  );
  const activeGuideImageIndex = useMemo(() => {
    if (guideImageCount === 0) return -1;
    if (recordingElapsedSeconds !== null && hasTimedGuideImages) {
      const currentElapsedSeconds = Math.max(0, recordingElapsedSeconds);
      let timedIndex = 0;
      guideImageEntries.forEach((entry, index) => {
        if (entry.startSecond !== null && currentElapsedSeconds >= entry.startSecond) {
          timedIndex = index;
        }
      });
      return timedIndex;
    }
    return manualGuideImageIndex;
  }, [
    guideImageCount,
    guideImageEntries,
    hasTimedGuideImages,
    manualGuideImageIndex,
    recordingElapsedSeconds,
  ]);
  const guideImageSrc =
    activeGuideImageIndex >= 0 ? guideImageEntries[activeGuideImageIndex]?.url ?? null : null;
  const hasMultipleGuideImages = guideImageCount > 1;
  const isGuideImageNavigationDisabled = recordingStatus === 'recording' && hasTimedGuideImages;
  const shouldShowGuideImageToggle = Boolean(guideImageSrc);
  const isGuideImageVisible =
    Boolean(guideImageSrc) && (cutGuideVisibility[activeCutIndex] ?? true);
  const exampleReels: TemplateExampleReel[] =
    template?.exampleReels && template.exampleReels.length > 0
      ? template.exampleReels
      : (template?.exampleReelUrls ?? []).map((url) => ({
          url,
          instagramOnly: false,
        }));
  const exampleReelUrls = exampleReels.map((reel) => reel.url);
  const canOpenActiveCutGuide = Boolean(template && cuts.length > 0 && activeCut);
  const activeCutDurationMode = activeCut?.isFixed
    ? null
    : (activeCut?.durationMode ?? DURATION_MODE_RECOMMENDED);
  const activeCutDurationSeconds = Math.max(0, activeCut?.durationSeconds ?? 0);
  const elapsedSeconds = Math.max(0, recordingElapsedSeconds ?? 0);
  const forcedRemainingSeconds = Math.max(0, activeCutDurationSeconds - elapsedSeconds);
  const isRecommendedTimingExceeded =
    activeCutDurationMode === DURATION_MODE_RECOMMENDED &&
    activeCutDurationSeconds > 0 &&
    elapsedSeconds >= activeCutDurationSeconds;
  const showRecommendedTimingToast =
    recordingStatus === 'recording' &&
    activeCutDurationMode === DURATION_MODE_RECOMMENDED &&
    isRecommendedTimingExceeded;
  const trimDurationSeconds = Math.max(0, trimEndSeconds - trimStartSeconds);
  const trimSliderMax = trimSourceMetadata?.duration ?? 0;
  const trimTargetCut =
    trimTargetCutIndex === null ? activeCut : (cuts[trimTargetCutIndex] ?? null);
  const trimTargetDurationSeconds = Math.max(0, trimTargetCut?.durationSeconds ?? 0);
  const recommendedTrimSeconds =
    trimTargetDurationSeconds > 0 ? trimTargetDurationSeconds : trimDurationSeconds;
  const minTrimDurationForSource = Math.min(
    MIN_TRIM_DURATION_SECONDS,
    trimSliderMax > 0 ? trimSliderMax : MIN_TRIM_DURATION_SECONDS
  );

  const handleGuideImageToggle = useCallback(() => {
    if (!guideImageSrc) return;
    setCutGuideVisibility((prev) => ({
      ...prev,
      [activeCutIndex]: !(prev[activeCutIndex] ?? true),
    }));
  }, [activeCutIndex, guideImageSrc]);

  const handlePrevGuideImage = useCallback(() => {
    if (guideImageCount <= 1 || isGuideImageNavigationDisabled) return;
    setGuideImageIndexByCut((prev) => {
      const current = Math.min(prev[activeCutIndex] ?? activeGuideImageIndex, guideImageCount - 1);
      return {
        ...prev,
        [activeCutIndex]: Math.max(0, current - 1),
      };
    });
  }, [activeCutIndex, activeGuideImageIndex, guideImageCount, isGuideImageNavigationDisabled]);

  const handleNextGuideImage = useCallback(() => {
    if (guideImageCount <= 1 || isGuideImageNavigationDisabled) return;
    setGuideImageIndexByCut((prev) => {
      const current = Math.min(prev[activeCutIndex] ?? activeGuideImageIndex, guideImageCount - 1);
      return {
        ...prev,
        [activeCutIndex]: Math.min(guideImageCount - 1, current + 1),
      };
    });
  }, [activeCutIndex, activeGuideImageIndex, guideImageCount, isGuideImageNavigationDisabled]);

  const findNextCaptureCutIndex = useCallback(
    (fromIndex: number) =>
      cuts.findIndex((cut, cutIndex) => cutIndex > fromIndex && !cut.isFixed),
    [cuts]
  );

  const handleTemplateGuidePrimaryAction = useCallback(() => {
    if (templateGuideStep === 'overview') {
      setTemplateGuideStep(0);
      return;
    }

    const cutIndex = templateGuideStep;
    const guideCut = cuts[cutIndex];
    if (!guideCut) {
      setIsTemplateGuideOpen(false);
      return;
    }

    if (guideCut.isFixed) {
      const nextCaptureIndex = findNextCaptureCutIndex(cutIndex);
      if (nextCaptureIndex >= 0) {
        setTemplateGuideStep(nextCaptureIndex);
        return;
      }
    }

    setActiveCutIndex(cutIndex);
    setIsTemplateGuideOpen(false);
  }, [cuts, findNextCaptureCutIndex, templateGuideStep]);

  const pauseTrimPlayback = useCallback(() => {
    if (trimPlaybackRafRef.current !== null) {
      cancelAnimationFrame(trimPlaybackRafRef.current);
      trimPlaybackRafRef.current = null;
    }
    const previewVideo = trimPreviewVideoRef.current;
    if (previewVideo && !previewVideo.paused) {
      previewVideo.pause();
    }
    setIsTrimPlaying(false);
  }, []);

  const timelineXToSeconds = useCallback(
    (clientX: number) => {
      const timeline = trimTimelineRef.current;
      if (!timeline || trimSliderMax <= 0) return 0;
      const rect = timeline.getBoundingClientRect();
      if (rect.width <= 0) return 0;
      const progress = clampValue((clientX - rect.left) / rect.width, 0, 1);
      return progress * trimSliderMax;
    },
    [trimSliderMax]
  );

  const secondsToTimelineX = useCallback(
    (seconds: number) => {
      if (trimSliderMax <= 0) return 0;
      return clampValue((seconds / trimSliderMax) * 100, 0, 100);
    },
    [trimSliderMax]
  );

  const handleTrimPlayToggle = useCallback(async () => {
    const previewVideo = trimPreviewVideoRef.current;
    if (!previewVideo || !trimSourceMetadata) return;

    if (isTrimPlaying) {
      pauseTrimPlayback();
      return;
    }

    const startAt = clampValue(trimScrubSeconds, trimStartSeconds, trimEndSeconds);
    if (trimEndSeconds - startAt < 0.02) {
      setTrimScrubSeconds(trimEndSeconds);
      return;
    }

    try {
      previewVideo.currentTime = startAt;
      const playPromise = previewVideo.play();
      if (playPromise) {
        await playPromise;
      }
      setIsTrimPlaying(true);
      setTrimError(null);
    } catch {
      setIsTrimPlaying(false);
      setTrimError('미리보기를 재생하지 못했습니다.');
    }
  }, [
    isTrimPlaying,
    pauseTrimPlayback,
    trimEndSeconds,
    trimScrubSeconds,
    trimSourceMetadata,
    trimStartSeconds,
  ]);

  const handleTrimPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, dragMode: Exclude<TrimDragMode, 'none'>) => {
      if (trimSliderMax <= 0) return;
      event.preventDefault();
      event.stopPropagation();
      pauseTrimPlayback();
      trimDragPointerIdRef.current = event.pointerId;
      trimDragStartRef.current = {
        pointerX: event.clientX,
        startSeconds: trimStartSeconds,
        endSeconds: trimEndSeconds,
        scrubSeconds: trimScrubSeconds,
      };
      setActiveTrimDrag(dragMode);
      setTrimError(null);
    },
    [pauseTrimPlayback, trimEndSeconds, trimScrubSeconds, trimSliderMax, trimStartSeconds]
  );

  const handleTrimScrubPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (trimSliderMax <= 0) return;
      const rawSeconds = timelineXToSeconds(event.clientX);
      const currentStart = trimBoundsRef.current.start;
      const currentEnd = trimBoundsRef.current.end;
      const safeScrub = clampValue(rawSeconds, currentStart, currentEnd);
      setTrimScrubSeconds(safeScrub);
      handleTrimPointerDown(event, 'scrub');
    },
    [handleTrimPointerDown, timelineXToSeconds, trimSliderMax]
  );

  const resetTrimState = useCallback(() => {
    pauseTrimPlayback();
    trimDragPointerIdRef.current = null;
    trimDragStartRef.current = null;
    setTrimSourceFile(null);
    setTrimSourceMetadata(null);
    setTrimStartSeconds(0);
    setTrimEndSeconds(0);
    setTrimScrubSeconds(0);
    setActiveTrimDrag('none');
    setTrimPreviewMaxHeight(null);
    setTrimThumbnails([]);
    setIsTrimPreparing(false);
    setTrimError(null);
    setTrimTargetCutIndex(null);
    setTrimSourceUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return null;
    });
  }, [pauseTrimPlayback]);

  const closeTrimModal = useCallback(() => {
    setIsTrimOpen(false);
    resetTrimState();
  }, [resetTrimState]);

  const loadVideoMetadataFromUrl = useCallback(async (url: string): Promise<VideoMetadata> => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.playsInline = true;
    video.muted = true;
    video.src = url;

    try {
      return await new Promise<VideoMetadata>((resolve, reject) => {
        const onLoadedMetadata = () => {
          cleanup();
          const duration =
            Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
          const width = video.videoWidth;
          const height = video.videoHeight;
          logVideoDebug('gallery metadata loaded', {
            duration,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            metadataWidth: width,
            metadataHeight: height,
          });
          if (!isValidMediaSize(width, height)) {
            reject(new Error('영상 해상도 정보를 확인하지 못했습니다.'));
            return;
          }
          resolve({ duration, width, height });
        };
        const onError = () => {
          cleanup();
          reject(new Error('영상 정보를 불러오지 못했습니다.'));
        };
        const cleanup = () => {
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          video.removeEventListener('error', onError);
        };
        video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
        video.addEventListener('error', onError, { once: true });
      });
    } finally {
      video.src = '';
    }
  }, [logVideoDebug]);

  const seekVideoTo = useCallback(async (video: HTMLVideoElement, time: number) => {
    if (Math.abs(video.currentTime - time) < 0.02) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const onSeeked = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error('영상 탐색 중 오류가 발생했습니다.'));
      };
      const cleanup = () => {
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onError);
      };
      video.addEventListener('seeked', onSeeked, { once: true });
      video.addEventListener('error', onError, { once: true });
      video.currentTime = time;
    });
  }, []);

  const generateTimelineThumbnails = useCallback(
    async (url: string, metadata: VideoMetadata): Promise<string[]> => {
      const video = document.createElement('video');
      video.src = url;
      video.preload = 'auto';
      video.playsInline = true;
      video.muted = true;

      await new Promise<void>((resolve, reject) => {
        const onLoadedData = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          reject(new Error('썸네일을 생성하지 못했습니다.'));
        };
        const cleanup = () => {
          video.removeEventListener('loadeddata', onLoadedData);
          video.removeEventListener('error', onError);
        };
        video.addEventListener('loadeddata', onLoadedData, { once: true });
        video.addEventListener('error', onError, { once: true });
      });

      const sourceWidth = metadata.width || video.videoWidth || 720;
      const sourceHeight = metadata.height || video.videoHeight || 1280;
      const ratio = sourceWidth / Math.max(1, sourceHeight);
      const thumbnailHeight = 72;
      const thumbnailWidth = Math.max(48, Math.round(thumbnailHeight * ratio));
      const canvas = document.createElement('canvas');
      canvas.width = thumbnailWidth;
      canvas.height = thumbnailHeight;
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('썸네일 캔버스를 준비하지 못했습니다.');
      }

      const maxFrameCount = Math.min(
        TIMELINE_THUMBNAIL_COUNT,
        Math.max(2, Math.ceil(metadata.duration || 2))
      );
      const thumbnails: string[] = [];
      for (let i = 0; i < maxFrameCount; i += 1) {
        const progress = maxFrameCount === 1 ? 0 : i / (maxFrameCount - 1);
        const targetTime = Math.max(0, (metadata.duration || 0) * progress);
        try {
          await seekVideoTo(video, targetTime);
        } catch {
          // iOS 일부 환경에서 마지막 seek가 실패할 수 있어 가능한 프레임만 사용한다.
        }
        context.clearRect(0, 0, thumbnailWidth, thumbnailHeight);
        context.drawImage(video, 0, 0, thumbnailWidth, thumbnailHeight);
        thumbnails.push(canvas.toDataURL('image/jpeg', 0.78));
      }

      video.src = '';
      return thumbnails;
    },
    [seekVideoTo]
  );

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
        const normalizedExampleReels: TemplateExampleReel[] = Array.isArray(data?.exampleReels)
          ? data.exampleReels
              .filter((reel): reel is TemplateExampleReel => {
                if (!reel || typeof reel.url !== 'string') return false;
                return reel.url.trim().length > 0;
              })
              .map((reel) => ({
                url: reel.url.trim(),
                instagramOnly: Boolean(reel.instagramOnly),
              }))
          : Array.isArray(data?.exampleReelUrls)
            ? data.exampleReelUrls
                .filter((url): url is string => {
                  if (typeof url !== 'string') return false;
                  return url.trim().length > 0;
                })
                .map((url) => ({
                  url: url.trim(),
                  instagramOnly: false,
                }))
            : [];
        const normalized = {
          ...data,
          tags: Array.isArray(data?.tags) ? data.tags : [],
          cuts: Array.isArray(data?.cuts) ? data.cuts : [],
          exampleReels: normalizedExampleReels,
          exampleReelUrls: normalizedExampleReels.map((reel) => reel.url),
        };

        if (!normalized.cuts || normalized.cuts.length === 0) {
          throw new Error('템플릿 컷 정보가 없습니다.');
        }

        if (isMounted) {
          setTemplate(normalized);
        }
      } catch (error: unknown) {
        if (isMounted) {
          setTemplateError(getErrorMessage(error, '템플릿 정보를 불러오지 못했습니다.'));
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

  const createReelsSession = useCallback(async () => {
    if (!templateId || !template) return;
    const initKey = `${templateId}:${requestedSessionId ?? 'new'}`;
    if (sessionInitKeyRef.current === initKey) return;
    sessionInitKeyRef.current = initKey;

    const fallbackMessage = getSessionFallbackMessage(requestedSessionId);
    setIsSessionLoading(true);
    setSessionError(null);
    sessionHydratedRef.current = false;
    try {
      const response = requestedSessionId
        ? await fetch(`/api/reels-maker/sessions/${encodeURIComponent(requestedSessionId)}`, {
            method: 'GET',
            cache: 'no-store',
          })
        : await fetch('/api/reels-maker/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ templateId }),
          });

      const payload = (await response.json()) as
        | WebApiResponse<ReelsMakerSessionResponse>
        | ReelsMakerErrorResponse;
      if (!response.ok || !payload?.success || !payload?.data) {
        const status =
          typeof payload?.status === 'number' ? payload.status : response.status;
        const errorCode =
          typeof payload?.errorCode === 'string' ? payload.errorCode : null;
        const nextSessionError = buildSessionErrorState({
          status,
          errorCode,
          message: payload?.message,
          fallbackMessage,
        });

        if (nextSessionError.type === 'auth') {
          setUser(null);
        }
        sessionInitKeyRef.current = null;
        setSessionError(nextSessionError);
        setSessionId(null);
        setSessionClipMap({});
        return;
      }

      const session = payload.data as ReelsMakerSessionResponse;
      if (session.templateId !== templateId) {
        throw new Error('선택한 템플릿과 저장된 프로젝트가 일치하지 않습니다.');
      }
      const mapping: Record<number, number> = {};
      (session.clips ?? []).forEach((clip) => {
        if (clip?.order != null && clip?.clipId != null) {
          mapping[clip.order] = clip.clipId;
        }
      });
      setSessionId(session.sessionId);
      setSessionClipMap(mapping);
      const restoredCaptions = normalizeSessionCaptions(session.captionItems);
      setCaptions(restoredCaptions);
      setCaptionsEnabled(session.captionsEnabled !== false);
      setAutoCaptionAvailable(Boolean(session.autoCaptionAvailable));
      setAutoCaptionRemainingAttempts(
        session.autoCaptionRemainingAttempts ?? 0
      );
      setActiveAutoCaptionJobId(session.activeAutoCaptionJobId ?? null);
      setLatestAutoCaptionJobId(session.latestAutoCaptionJobId ?? null);
      setStaleAutoCaptionClipIds(session.staleAutoCaptionClipIds ?? []);
      setAcceptedStaleAutoCaptionClipIds([]);
      setSelectedCaptionId(restoredCaptions[0]?.id ?? null);
      setEditingCaptionId(null);
      const resolvedProjectName =
        session.projectName?.trim() || `${template.title || '릴스'} 프로젝트`;
      const resolvedDraftVersion = session.draftVersion ?? 0;
      if (session.status === 'PROCESSING') {
        setStage('processing');
      } else if (session.status === 'COMPLETED') {
        setFinalVideoUrl(session.finalVideoUrl || null);
        setFinalVideoMimeType('video/mp4');
        setStage('preview');
      } else if (session.status === 'FAILED') {
        setStage('capture');
      } else if (session.activeAutoCaptionJobId) {
        setStage('caption-edit');
      }

      if (!requestedSessionId && session.status === 'CAPTURE') {
        setTemplateGuideStep('overview');
        setIsTemplateGuideOpen(true);
      }

      const restoredUploadedCuts: Record<number, boolean> = {};
      const restoredClips: Array<ClipInfo | null> = Array(cuts.length).fill(null);
      await Promise.all(
        (session.clips ?? []).map(async (sessionClip) => {
          const index = cuts.findIndex((cut) => cut.order === sessionClip.order);
          if (index < 0) return;
          const cut = cuts[index];
          const isUploaded = sessionClip.status === 'UPLOADED';
          restoredUploadedCuts[index] = cut.isFixed || isUploaded;
          if (
            !requestedSessionId ||
            session.status !== 'CAPTURE' ||
            cut.isFixed ||
            !isUploaded ||
            !sessionClip.downloadUrl
          ) {
            return;
          }
          try {
            const clipResponse = await fetch(
              `/api/reels-maker/download?url=${encodeURIComponent(sessionClip.downloadUrl)}`,
              { method: 'GET', cache: 'no-store' }
            );
            if (!clipResponse.ok) return;
            const blob = await clipResponse.blob();
            const mimeType =
              sessionClip.contentType || blob.type || 'video/webm';
            restoredClips[index] = {
              blob,
              url: URL.createObjectURL(blob),
              duration:
                sessionClip.actualDurationSeconds ?? sessionClip.durationSeconds ?? 0,
              mimeType,
            };
          } catch {
            // 서버 업로드 상태는 유지하고 미리보기만 생략한다.
          }
        })
      );
      setUploadedCuts(restoredUploadedCuts);
      setClipSources({});
      const restoredIndex = cuts.findIndex(
        (cut) => cut.order === session.lastActiveClipOrder
      );
      const resolvedActiveIndex = restoredIndex >= 0 ? restoredIndex : 0;
      if (requestedSessionId) {
        setClips((prev) => {
          prev.forEach((clip, index) => {
            if (clip?.url && !cuts[index]?.isFixed) {
              URL.revokeObjectURL(clip.url);
            }
          });
          return restoredClips;
        });
        setActiveCutIndex(resolvedActiveIndex);
      }
      hydrateDraft({
        projectName: resolvedProjectName,
        draftVersion: resolvedDraftVersion,
        lastEditedAt: session.lastEditedAt ?? null,
        activeClipOrder: cuts[resolvedActiveIndex]?.order ?? null,
        captions: restoredCaptions,
        captionsEnabled: session.captionsEnabled !== false,
      });
      sessionHydratedRef.current = true;
      if (!requestedSessionId) {
        sessionInitKeyRef.current = `${templateId}:${session.sessionId}`;
        router.replace(
          buildReelsMakerHref({
            templateId,
            sessionId: session.sessionId,
            returnUrl: explicitCompletionReturnUrl,
          })
        );
      }
    } catch (error: unknown) {
      sessionInitKeyRef.current = null;
      setSessionError({
        type: 'generic',
        message: getErrorMessage(error, fallbackMessage),
      });
      setSessionId(null);
      setSessionClipMap({});
    } finally {
      setIsSessionLoading(false);
    }
  }, [
    cuts,
    explicitCompletionReturnUrl,
    hydrateDraft,
    requestedSessionId,
    router,
    setUser,
    setEditingCaptionId,
    setSelectedCaptionId,
    template,
    templateId,
  ]);

  useEffect(() => {
    createReelsSession();
  }, [createReelsSession]);

  useEffect(() => {
    if (!template) return;

    setActiveCutIndex(0);
    setRecordingStatus('idle');
    setRecordingElapsedSeconds(null);
    setSessionId(null);
    setSessionClipMap({});
    setSessionError(null);
    resetDraft();
    sessionHydratedRef.current = false;
    setUploadedCuts({});
    setUploadingCuts({});
    setClipUploadErrors({});
    setCaptions([]);
    setCaptionsEnabled(true);
    setAutoCaptionAvailable(false);
    setAutoCaptionRemainingAttempts(0);
    setActiveAutoCaptionJobId(null);
    setLatestAutoCaptionJobId(null);
    setStaleAutoCaptionClipIds([]);
    setAcceptedStaleAutoCaptionClipIds([]);
    setSelectedCaptionId(null);
    setCutGuideVisibility(() => {
      const next: Record<number, boolean> = {};
      cuts.forEach((cut, index) => {
        next[index] = parseGuideImageEntries(cut.guideImageUrl).length > 0;
      });
      return next;
    });
    setGuideImageIndexByCut({});
    setEditingCaptionId(null);
    resetCaptionGesture();
    setClips((prev) => {
      prev.forEach((clip) => clip?.url && URL.revokeObjectURL(clip.url));
      return Array(cuts.length).fill(null);
    });
    setFixedClipErrors({});
    setClipPosters({});
    setClipSources({});
    setFinalVideoUrl((prev) => {
      revokeBlobUrl(prev);
      return null;
    });
    setFinalPosterUrl(null);
    setFinalVideoMimeType('video/mp4');
    setIsPreviewOpen(false);
    setGalleryError(null);
    setIsGalleryProcessing(false);
    setIsMediaSourceOpen(false);
    setIsMediaPickerActive(false);
    setMediaPickerTargetCutIndex(null);
    setTrimTargetCutIndex(null);
    setReplacementConfirm(null);
    setIsTrimOpen(false);
    setIsTemplateGuideOpen(false);
    setTemplateGuideStep('overview');
    resetTrimState();
  }, [
    template?.id,
    cuts,
    resetCaptionGesture,
    resetDraft,
    resetTrimState,
    setEditingCaptionId,
    setSelectedCaptionId,
  ]);

  useEffect(() => {
    if (cuts.length === 0) return;
    setUploadedCuts(() => {
      const next: Record<number, boolean> = {};
      cuts.forEach((cut, index) => {
        next[index] = cut.isFixed;
      });
      return next;
    });
  }, [cuts]);

  useEffect(() => {
    if (cuts.length === 0) return;
    if (activeCutIndex >= cuts.length) {
      setActiveCutIndex(0);
    }
  }, [cuts.length, activeCutIndex]);

  useEffect(() => {
    if (typeof templateGuideStep === 'number' && templateGuideStep >= cuts.length) {
      setTemplateGuideStep('overview');
    }
  }, [cuts.length, templateGuideStep]);

  useEffect(() => {
    if (!isTemplateGuideOpen) {
      setExampleReelIndex(0);
    }
  }, [isTemplateGuideOpen]);

  useEffect(() => {
    if (exampleReelUrls.length === 0) {
      setExampleReelIndex(0);
      return;
    }
    setExampleReelIndex((prev) => Math.min(prev, exampleReelUrls.length - 1));
  }, [exampleReelUrls.length]);

  useEffect(() => {
    if (!isCaptureMenuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isCaptureMenuOpen]);

  const stopCamera = useCallback(() => {
    setStream((current) => {
      if (current) {
        current.getTracks().forEach((track) => track.stop());
      }
      return null;
    });
  }, []);

  const buildFixedVideoProxyUrl = useCallback((rawUrl: string) => {
    return rawUrl;
  }, []);

  const ensureVideoPlayable = useCallback(async (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    return new Promise<void>((resolve, reject) => {
      const cleanup = () => URL.revokeObjectURL(url);
      video.onloadeddata = () => {
        cleanup();
        resolve();
      };
      video.onerror = () => {
        cleanup();
        reject(new Error('영상 코덱을 지원하지 않습니다.'));
      };
      video.src = url;
      video.load();
    });
  }, []);

  const downloadFixedClip = useCallback(
    async (url: string, durationSeconds: number): Promise<ClipInfo> => {
      const fixedUrl = buildFixedVideoProxyUrl(url);
      let requestUrl = fixedUrl;
      try {
        const parsed = new URL(fixedUrl);
        parsed.searchParams.set('v', Date.now().toString());
        requestUrl = parsed.toString();
      } catch {
        requestUrl = fixedUrl;
      }
      const response = await fetch(requestUrl, { cache: 'no-store' });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.message || '고정 영상을 불러오지 못했습니다.');
      }
      const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
      if (contentType.includes('text/html')) {
        throw new Error('고정 영상 링크가 올바르지 않습니다. 직접 다운로드 링크를 확인해주세요.');
      }
      const blob = await response.blob();
      if (blob.type.toLowerCase().includes('text/html')) {
        throw new Error('고정 영상 링크가 올바르지 않습니다. 직접 다운로드 링크를 확인해주세요.');
      }
      if (!blob.size) {
        throw new Error('고정 영상 파일이 비어 있습니다.');
      }
      const mimeType = blob.type || 'video/mp4';
      await ensureVideoPlayable(blob);
      const objectUrl = URL.createObjectURL(blob);
      return {
        blob,
        url: objectUrl,
        duration: durationSeconds,
        mimeType,
      };
    },
    [buildFixedVideoProxyUrl, ensureVideoPlayable]
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

  const setupCamera = useCallback(
    async (overrideFacingMode?: CameraFacingMode): Promise<MediaStream | null> => {
      const targetFacingMode = overrideFacingMode ?? cameraFacingMode;
      if (cameraSetupInProgressRef.current) {
        return null;
      }

      cameraSetupInProgressRef.current = true;
      setCameraError(null);

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
        logCameraTrackSnapshot('after-enhancements');
        if (videoTrack) {
          const handleTrackResize = () => logCameraTrackSnapshot('track-resize');
          videoTrack.addEventListener('resize', handleTrackResize);
          window.setTimeout(() => {
            logCameraTrackSnapshot('t+2000');
          }, 2000);
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
        setStream((current) => {
          if (current && current !== mediaStream) {
            current.getTracks().forEach((track) => track.stop());
          }
          return mediaStream;
        });
        return mediaStream;
      } catch {
        setCameraError('카메라/마이크 접근이 거부되었어요. 권한을 확인해주세요.');
        return null;
      } finally {
        cameraSetupInProgressRef.current = false;
      }
    },
    [cameraFacingMode, logVideoDebug]
  );

  const handleSwitchCamera = useCallback(async () => {
    if (switchCameraInProgressRef.current || isSwitchCameraDisabled) {
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
  }, [cameraFacingMode, isSwitchCameraDisabled, setupCamera, stopCamera]);

  useEffect(() => {
    if (stage === 'capture' && template && !isCaptureCameraPaused) {
      if (!stream) {
        void setupCamera();
      }
    } else {
      stopCamera();
    }
  }, [isCaptureCameraPaused, stage, setupCamera, stopCamera, stream, template]);

  useEffect(() => {
    latestClipsRef.current = clips;
  }, [clips]);

  useEffect(() => {
    uploadedCutsRef.current = uploadedCuts;
  }, [uploadedCuts]);

  useEffect(() => {
    return () => {
      latestClipsRef.current.forEach((clip) => clip?.url && URL.revokeObjectURL(clip.url));
      if (mediaPickerFocusTimeoutRef.current) {
        window.clearTimeout(mediaPickerFocusTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (trimSourceUrl) {
        URL.revokeObjectURL(trimSourceUrl);
      }
    };
  }, [trimSourceUrl]);

  useEffect(() => {
    return () => {
      pauseTrimPlayback();
    };
  }, [pauseTrimPlayback]);

  const createConfiguredRecorder = useCallback(
    (recordingStream: MediaStream, debugLabel: string) => {
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
    },
    [logVideoDebug]
  );

  const createRecorder = useCallback(
    (recordingStream: MediaStream) => {
      const configured = createConfiguredRecorder(recordingStream, 'camera');
      if (!configured) return null;

      recordingMimeTypeRef.current =
        configured.recorder.mimeType || configured.selectedMimeType || 'video/webm';
      return configured.recorder;
    },
    [createConfiguredRecorder]
  );

  const captureVideoSegmentToBlob = useCallback(
    async (
      sourceUrl: string,
      metadata: VideoMetadata,
      startSeconds: number,
      endSeconds: number
    ): Promise<{ blob: Blob; mimeType: string; duration: number }> => {
      const duration = Math.max(MIN_TRIM_DURATION_SECONDS, endSeconds - startSeconds);

      const video = document.createElement('video');
      video.src = sourceUrl;
      video.crossOrigin = 'anonymous';
      video.preload = 'auto';
      video.playsInline = true;
      video.muted = false;

      await new Promise<void>((resolve, reject) => {
        const onLoadedData = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          reject(new Error('영상을 불러오지 못했습니다.'));
        };
        const cleanup = () => {
          video.removeEventListener('loadeddata', onLoadedData);
          video.removeEventListener('error', onError);
        };
        video.addEventListener('loadeddata', onLoadedData, { once: true });
        video.addEventListener('error', onError, { once: true });
      });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context || !canvas.captureStream || !window.MediaRecorder) {
        throw new Error('이 브라우저에서는 영상 구간 편집을 지원하지 않습니다.');
      }

      const width = isValidMediaDimension(metadata.width)
        ? metadata.width
        : video.videoWidth;
      const height = isValidMediaDimension(metadata.height)
        ? metadata.height
        : video.videoHeight;
      logVideoDebug('gallery trim dimensions', {
        metadataWidth: metadata.width,
        metadataHeight: metadata.height,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        canvasWidth: width,
        canvasHeight: height,
        startSeconds,
        endSeconds,
      });
      if (!isValidMediaSize(width, height)) {
        throw new Error('영상 해상도 정보를 확인하지 못했습니다.');
      }
      canvas.width = width;
      canvas.height = height;

      const captureStream = canvas.captureStream(30);
      const AudioContextClass =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      const audioContext = AudioContextClass ? new AudioContextClass() : null;
      let audioDestination: MediaStreamAudioDestinationNode | null = null;

      if (audioContext) {
        try {
          await audioContext.resume();
          const audioSource = audioContext.createMediaElementSource(video);
          const gainNode = audioContext.createGain();
          gainNode.gain.value = 0;
          audioDestination = audioContext.createMediaStreamDestination();
          audioSource.connect(audioDestination);
          audioSource.connect(gainNode);
          gainNode.connect(audioContext.destination);
        } catch {
          audioDestination = null;
        }
      }

      const combinedStream = new MediaStream([
        ...captureStream.getVideoTracks(),
        ...(audioDestination?.stream.getAudioTracks() ?? []),
      ]);

      const configuredRecorder = createConfiguredRecorder(combinedStream, 'gallery trim');
      if (!configuredRecorder) {
        throw new Error('이 브라우저에서는 영상 구간 편집을 지원하지 않습니다.');
      }
      const { recorder, selectedMimeType } = configuredRecorder;
      const chunks: BlobPart[] = [];

      const outputBlob = await new Promise<Blob>(async (resolve, reject) => {
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };
        recorder.onerror = () => reject(new Error('영상 구간 처리 중 오류가 발생했습니다.'));
        recorder.onstop = () => {
          const blob = new Blob(chunks, {
            type: recorder.mimeType || selectedMimeType || 'video/webm',
          });
          logVideoDebug('gallery trim output blob', {
            type: blob.type,
            size: blob.size,
            duration,
            canvasWidth: canvas.width,
            canvasHeight: canvas.height,
            recorderMimeType: recorder.mimeType,
            recorderVideoBitsPerSecond: recorder.videoBitsPerSecond,
            recorderAudioBitsPerSecond: recorder.audioBitsPerSecond,
          });
          resolve(blob);
        };

        const videoWithFrameCallback = video as HTMLVideoElement & {
          requestVideoFrameCallback?: (callback: () => void) => number;
          cancelVideoFrameCallback?: (handle: number) => void;
        };
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

        try {
          await seekVideoTo(video, Math.max(0, startSeconds));
          recorder.start();
          drawFrame();

          video.currentTime = Math.max(0, startSeconds);
          await new Promise<void>((resolvePlay, rejectPlay) => {
            const onPlaying = () => {
              cleanup();
              resolvePlay();
            };
            const onError = () => {
              cleanup();
              rejectPlay(new Error('영상 재생에 실패했습니다.'));
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

          await new Promise<void>((resolveEnd) => {
            const checkTime = () => {
              if (video.currentTime >= endSeconds || video.ended) {
                resolveEnd();
                return;
              }
              requestAnimationFrame(checkTime);
            };
            checkTime();
          });
          video.pause();
          if (rafId) cancelAnimationFrame(rafId);
          if (frameCallbackId && videoWithFrameCallback.cancelVideoFrameCallback) {
            videoWithFrameCallback.cancelVideoFrameCallback(frameCallbackId);
          }
          recorder.stop();
        } catch (error) {
          if (recorder.state !== 'inactive') {
            recorder.stop();
          }
          reject(error);
        }
      });

      captureStream.getTracks().forEach((track) => track.stop());
      audioDestination?.stream.getTracks().forEach((track) => track.stop());
      if (audioContext) {
        audioContext.close().catch(() => undefined);
      }

      return {
        blob: outputBlob,
        mimeType: outputBlob.type || selectedMimeType || 'video/webm',
        duration,
      };
    },
    [createConfiguredRecorder, logVideoDebug, seekVideoTo]
  );

  const imageToVideoBlob = useCallback(
    async (
      file: File,
      durationSeconds: number
    ): Promise<{ blob: Blob; mimeType: string; duration: number }> => {
      if (!window.MediaRecorder) {
        throw new Error('이 브라우저에서는 사진을 영상으로 변환할 수 없습니다.');
      }

      const objectUrl = URL.createObjectURL(file);
      const image = document.createElement('img');
      image.src = objectUrl;
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('사진을 불러오지 못했습니다.'));
      });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context || !canvas.captureStream) {
        URL.revokeObjectURL(objectUrl);
        throw new Error('이 브라우저에서는 사진 변환을 지원하지 않습니다.');
      }

      const width = image.naturalWidth;
      const height = image.naturalHeight;
      logVideoDebug('image conversion dimensions', {
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        canvasWidth: width,
        canvasHeight: height,
      });
      if (!isValidMediaSize(width, height)) {
        URL.revokeObjectURL(objectUrl);
        throw new Error('사진 해상도 정보를 확인하지 못했습니다.');
      }
      canvas.width = width;
      canvas.height = height;
      context.drawImage(image, 0, 0, width, height);

      const streamFromCanvas = canvas.captureStream(30);
      const configuredRecorder = createConfiguredRecorder(streamFromCanvas, 'image conversion');
      if (!configuredRecorder) {
        URL.revokeObjectURL(objectUrl);
        throw new Error('이 브라우저에서는 사진을 영상으로 변환할 수 없습니다.');
      }
      const { recorder, selectedMimeType } = configuredRecorder;
      const chunks: BlobPart[] = [];
      const outputBlob = await new Promise<Blob>((resolve, reject) => {
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };
        recorder.onerror = () => reject(new Error('사진 변환 중 오류가 발생했습니다.'));
        recorder.onstop = () => {
          const blob = new Blob(chunks, {
            type: recorder.mimeType || selectedMimeType || 'video/webm',
          });
          logVideoDebug('image conversion output blob', {
            type: blob.type,
            size: blob.size,
            duration: Math.max(MIN_TRIM_DURATION_SECONDS, durationSeconds),
            canvasWidth: canvas.width,
            canvasHeight: canvas.height,
            recorderMimeType: recorder.mimeType,
            recorderVideoBitsPerSecond: recorder.videoBitsPerSecond,
            recorderAudioBitsPerSecond: recorder.audioBitsPerSecond,
          });
          resolve(blob);
        };
        recorder.start();
        window.setTimeout(() => {
          recorder.stop();
        }, Math.max(MIN_TRIM_DURATION_SECONDS, durationSeconds) * 1000);
      });

      streamFromCanvas.getTracks().forEach((track) => track.stop());
      URL.revokeObjectURL(objectUrl);
      return {
        blob: outputBlob,
        mimeType: outputBlob.type || selectedMimeType || 'video/webm',
        duration: Math.max(MIN_TRIM_DURATION_SECONDS, durationSeconds),
      };
    },
    [createConfiguredRecorder, logVideoDebug]
  );

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

  const revokeBlobUrl = useCallback((url: string | null) => {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }, []);

  const uploadRecordedClip = useCallback(
    async (index: number, blob: Blob, mimeType: string, duration: number) => {
      if (!sessionId) {
        throw new Error('릴스 제작 세션이 준비되지 않았습니다.');
      }
      const cut = cuts[index];
      const order = cut?.order ?? index + 1;
      const clipId = sessionClipMap[order];
      if (!clipId) {
        throw new Error('업로드할 클립 정보가 없습니다.');
      }

      setUploadingCuts((prev) => ({ ...prev, [index]: true }));
      setUploadedCuts((prev) => ({ ...prev, [index]: false }));
      setClipUploadErrors((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });

      try {
        const response = await fetch(`/api/reels-maker/sessions/${sessionId}/clips/presign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clipId, contentType: mimeType }),
        });

        const payload: WebApiResponse<ReelsMakerClipPresignResponse> = await response.json();
        if (!response.ok || !payload?.success || !payload?.data?.uploadUrl) {
          throw new Error(payload?.message || '업로드 URL 발급에 실패했습니다.');
        }

        const uploadResponse = await fetch(payload.data.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': mimeType },
          body: blob,
        });

        if (!uploadResponse.ok) {
          throw new Error('클립 업로드에 실패했습니다.');
        }

        const completeResponse = await fetch(
          `/api/reels-maker/sessions/${sessionId}/clips/${clipId}/upload-complete`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              objectKey: payload.data.objectKey,
              actualDurationSeconds: duration,
            }),
          }
        );
        const completePayload: WebApiResponse<ReelsMakerSessionResponse> =
          await completeResponse.json();
        if (!completeResponse.ok || !completePayload?.success || !completePayload?.data) {
          throw new Error(
            completePayload?.message || '클립 업로드 완료 처리에 실패했습니다.'
          );
        }
        applyServerUpdate(completePayload.data);
        setCaptionsEnabled(completePayload.data.captionsEnabled !== false);
        setAutoCaptionAvailable(
          Boolean(completePayload.data.autoCaptionAvailable)
        );
        setAutoCaptionRemainingAttempts(
          completePayload.data.autoCaptionRemainingAttempts ?? 0
        );
        setActiveAutoCaptionJobId(
          completePayload.data.activeAutoCaptionJobId ?? null
        );
        setLatestAutoCaptionJobId(
          completePayload.data.latestAutoCaptionJobId ?? null
        );
        setStaleAutoCaptionClipIds(
          completePayload.data.staleAutoCaptionClipIds ?? []
        );
        setAcceptedStaleAutoCaptionClipIds((current) =>
          current.filter((acceptedClipId) => acceptedClipId !== clipId)
        );
        setUploadedCuts((prev) => ({ ...prev, [index]: true }));
      } finally {
        setUploadingCuts((prev) => ({ ...prev, [index]: false }));
      }
    },
    [applyServerUpdate, cuts, sessionClipMap, sessionId]
  );

  const saveClipAtIndex = useCallback(
    async (
      index: number,
      clipPayload: { blob: Blob; mimeType: string; duration: number },
      clipSource: ClipSource,
      shouldAdvanceToNextCut: boolean = true
    ) => {
      const { blob, mimeType, duration } = clipPayload;
      const previousUploaded = uploadedCutsRef.current[index] ?? false;
      let poster: string | null = null;

      try {
        poster = await createPosterFromClip({
          blob,
          url: '',
          duration,
          mimeType,
        });
      } catch {
        // 포스터 생성 실패는 업로드를 막지 않는다.
      }

      try {
        await uploadRecordedClip(index, blob, mimeType, duration);
      } catch (error) {
        if (previousUploaded) {
          setUploadedCuts((prev) => ({ ...prev, [index]: true }));
        }
        throw error;
      }

      const url = URL.createObjectURL(blob);
      setClips((prev) => {
        const next = [...prev];
        if (next[index]?.url) {
          URL.revokeObjectURL(next[index]!.url);
        }
        next[index] = {
          blob,
          url,
          duration,
          mimeType,
        };
        return next;
      });

      if (poster) {
        setClipPosters((prev) => ({
          ...prev,
          [index]: poster,
        }));
      } else {
        setClipPosters((prev) => {
          const next = { ...prev };
          delete next[index];
          return next;
        });
      }

      setClipSources((prev) => ({
        ...prev,
        [index]: clipSource,
      }));
      setRecordingStatus('done');
      setGalleryError(null);
      setCameraError(null);

      if (!shouldAdvanceToNextCut) return;
      if (index >= cuts.length - 1) return;

      const nextCaptureIndex = findNextCaptureCutIndex(index);
      if (nextCaptureIndex !== -1) {
        setActiveCutIndex(nextCaptureIndex);
        setTemplateGuideStep(nextCaptureIndex);
        setIsTemplateGuideOpen(true);
      } else {
        setActiveCutIndex(index + 1);
      }
    },
    [createPosterFromClip, cuts.length, findNextCaptureCutIndex, uploadRecordedClip]
  );

  const finishMediaPicker = useCallback(() => {
    if (mediaPickerFocusTimeoutRef.current) {
      window.clearTimeout(mediaPickerFocusTimeoutRef.current);
      mediaPickerFocusTimeoutRef.current = null;
    }
    setIsMediaPickerActive(false);
  }, []);

  const handleSelectedMediaFile = useCallback(
    async (file: File, targetIndex: number) => {
      const targetCut = cuts[targetIndex];
      if (!targetCut || targetCut.isFixed) return;

      setActiveCutIndex(targetIndex);
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');
      if (!isVideo && !isImage) {
        setGalleryError('사진 또는 영상 파일만 선택할 수 있습니다.');
        return;
      }

      setGalleryError(null);
      setTrimError(null);

      if (isImage) {
        setIsGalleryProcessing(true);
        try {
          const targetCutDurationSeconds = Math.max(0, targetCut.durationSeconds ?? 0);
          const targetDuration =
            targetCutDurationSeconds > 0
              ? targetCutDurationSeconds
              : DEFAULT_GALLERY_CLIP_DURATION_SECONDS;
          const converted = await imageToVideoBlob(file, targetDuration);
          await saveClipAtIndex(
            targetIndex,
            converted,
            'file',
            !latestClipsRef.current[targetIndex] && !uploadedCutsRef.current[targetIndex]
          );
        } catch (error: unknown) {
          const message = getErrorMessage(error, '사진을 영상으로 변환하지 못했습니다.');
          setGalleryError(message);
          alert(message);
        } finally {
          setIsGalleryProcessing(false);
        }
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      setIsTrimPreparing(true);
      try {
        const metadata = await loadVideoMetadataFromUrl(objectUrl);
        if (!Number.isFinite(metadata.duration) || metadata.duration <= 0) {
          throw new Error('선택한 영상 길이를 확인하지 못했습니다.');
        }

        const targetCutDurationSeconds = Math.max(0, targetCut.durationSeconds ?? 0);
        const minTrimDurationForMetadata = Math.min(
          MIN_TRIM_DURATION_SECONDS,
          metadata.duration > 0 ? metadata.duration : MIN_TRIM_DURATION_SECONDS
        );
        const preferredDuration =
          targetCutDurationSeconds > 0
            ? Math.min(metadata.duration, targetCutDurationSeconds)
            : metadata.duration;
        const safeStart = 0;
        const safeEnd = Math.max(
          Math.min(metadata.duration, preferredDuration),
          Math.min(metadata.duration, minTrimDurationForMetadata)
        );
        setTrimSourceFile(file);
        setTrimSourceUrl((current) => {
          if (current) {
            URL.revokeObjectURL(current);
          }
          return objectUrl;
        });
        setTrimSourceMetadata(metadata);
        setTrimStartSeconds(safeStart);
        setTrimEndSeconds(safeEnd);
        setTrimScrubSeconds(safeStart);
        setActiveTrimDrag('none');
        setIsTrimPlaying(false);
        setIsTrimOpen(true);
        setTrimTargetCutIndex(targetIndex);
        setTrimError(null);

        try {
          const thumbnails = await generateTimelineThumbnails(objectUrl, metadata);
          setTrimThumbnails(thumbnails);
        } catch {
          setTrimThumbnails([]);
        }
      } catch (error: unknown) {
        URL.revokeObjectURL(objectUrl);
        const message = getErrorMessage(error, '영상을 준비하지 못했습니다.');
        setGalleryError(message);
        setTrimError(message);
      } finally {
        setIsTrimPreparing(false);
      }
    },
    [
      cuts,
      generateTimelineThumbnails,
      imageToVideoBlob,
      loadVideoMetadataFromUrl,
      saveClipAtIndex,
    ]
  );

  const handleMediaFileInputChange = useCallback(
    async (event: ReactChangeEvent<HTMLInputElement>) => {
      const input = event.target;
      const file = input.files?.[0];
      input.value = '';
      if (!file) {
        finishMediaPicker();
        return;
      }

      const targetIndex = mediaPickerTargetIndexRef.current ?? activeCutIndex;
      try {
        await handleSelectedMediaFile(file, targetIndex);
      } finally {
        finishMediaPicker();
      }
    },
    [activeCutIndex, finishMediaPicker, handleSelectedMediaFile]
  );

  const openFallbackFilePicker = useCallback(
    (inputRef: RefObject<HTMLInputElement | null>, targetIndex: number) => {
      mediaPickerTargetIndexRef.current = targetIndex;
      setMediaPickerTargetCutIndex(targetIndex);
      stopCamera();
      setIsMediaPickerActive(true);

      if (mediaPickerFocusTimeoutRef.current) {
        window.clearTimeout(mediaPickerFocusTimeoutRef.current);
      }
      const handlePickerFocus = () => {
        mediaPickerFocusTimeoutRef.current = window.setTimeout(() => {
          finishMediaPicker();
        }, 400);
      };
      window.addEventListener('focus', handlePickerFocus, { once: true });

      try {
        const input = inputRef.current;
        if (!input) {
          window.removeEventListener('focus', handlePickerFocus);
          finishMediaPicker();
          return;
        }
        input.click();
      } catch {
        window.removeEventListener('focus', handlePickerFocus);
        finishMediaPicker();
      }
    },
    [finishMediaPicker, stopCamera]
  );

  const openGalleryPickerForIndex = useCallback(
    async (
      targetIndex: number,
      options: { skipReplacementConfirm?: boolean } = {}
    ) => {
      const targetCut = cuts[targetIndex];
      if (!targetCut || targetCut.isFixed || uploadingCuts[targetIndex] || isMediaImportBlocked) {
        return;
      }

      setActiveCutIndex(targetIndex);
      setIsMediaSourceOpen(false);
      setGalleryError(null);
      setTrimError(null);

      if (
        clipSources[targetIndex] === 'recording' &&
        !options.skipReplacementConfirm
      ) {
        setReplacementConfirm({ type: 'gallery', cutIndex: targetIndex });
        return;
      }

      mediaPickerTargetIndexRef.current = targetIndex;
      setMediaPickerTargetCutIndex(targetIndex);
      stopCamera();

      const pickerWindow = window as WindowWithOpenFilePicker;
      if (!pickerWindow.showOpenFilePicker) {
        openFallbackFilePicker(galleryFileInputRef, targetIndex);
        return;
      }

      setIsMediaPickerActive(true);
      try {
        const [fileHandle] = await pickerWindow.showOpenFilePicker({
          multiple: false,
          excludeAcceptAllOption: true,
          types: GALLERY_FILE_PICKER_TYPES,
        });
        const file = await fileHandle?.getFile();
        if (file) {
          await handleSelectedMediaFile(file, targetIndex);
        }
      } catch (error: unknown) {
        const isAbortError =
          error instanceof DOMException && error.name === 'AbortError';
        if (!isAbortError) {
          const message = getErrorMessage(error, '파일을 선택하지 못했습니다.');
          setGalleryError(message);
        }
      } finally {
        finishMediaPicker();
      }
    },
    [
      clipSources,
      cuts,
      finishMediaPicker,
      handleSelectedMediaFile,
      isMediaImportBlocked,
      openFallbackFilePicker,
      stopCamera,
      uploadingCuts,
    ]
  );

  const selectVideoCaptureModeForIndex = useCallback(
    (targetIndex: number) => {
      const targetCut = cuts[targetIndex];
      if (!targetCut || targetCut.isFixed || uploadingCuts[targetIndex]) {
        return;
      }

      setActiveCutIndex(targetIndex);
      setIsMediaSourceOpen(false);
      setGalleryError(null);
      setTrimError(null);
    },
    [cuts, uploadingCuts]
  );

  const openCutMediaSource = useCallback(
    (targetIndex: number) => {
      const targetCut = cuts[targetIndex];
      if (!targetCut || targetCut.isFixed || uploadingCuts[targetIndex] || isMediaImportBlocked) {
        return;
      }

      setActiveCutIndex(targetIndex);
      mediaPickerTargetIndexRef.current = targetIndex;
      setMediaPickerTargetCutIndex(targetIndex);
      setGalleryError(null);
      setTrimError(null);
      setIsMediaSourceOpen(true);
    },
    [cuts, isMediaImportBlocked, uploadingCuts]
  );

  const closeCutMediaSource = useCallback(() => {
    setIsMediaSourceOpen(false);
    setMediaPickerTargetCutIndex(null);
    mediaPickerTargetIndexRef.current = null;
  }, []);

  const handleGalleryFileChange = handleMediaFileInputChange;

  const handleTrimConfirm = useCallback(async () => {
    if (!trimSourceUrl || !trimSourceMetadata) {
      setTrimError('영상 정보가 없습니다.');
      return;
    }
    const targetIndex = trimTargetCutIndex ?? activeCutIndex;
    const targetCut = cuts[targetIndex];
    if (!targetCut || targetCut.isFixed) {
      setTrimError('현재 컷에는 갤러리 영상을 적용할 수 없습니다.');
      return;
    }
    if (trimDurationSeconds < minTrimDurationForSource) {
      setTrimError('선택 구간이 너무 짧습니다.');
      return;
    }

    pauseTrimPlayback();
    setIsGalleryProcessing(true);
    setTrimError(null);
    try {
      const converted = await captureVideoSegmentToBlob(
        trimSourceUrl,
        trimSourceMetadata,
        trimStartSeconds,
        trimEndSeconds
      );
      await saveClipAtIndex(
        targetIndex,
        converted,
        'file',
        !latestClipsRef.current[targetIndex] && !uploadedCutsRef.current[targetIndex]
      );
      closeTrimModal();
    } catch (error: unknown) {
      const message = getErrorMessage(error, '영상 구간을 처리하지 못했습니다.');
      setTrimError(message);
      setGalleryError(message);
    } finally {
      setIsGalleryProcessing(false);
    }
  }, [
    activeCutIndex,
    captureVideoSegmentToBlob,
    closeTrimModal,
    cuts,
    minTrimDurationForSource,
    pauseTrimPlayback,
    saveClipAtIndex,
    trimDurationSeconds,
    trimEndSeconds,
    trimSourceMetadata,
    trimSourceUrl,
    trimStartSeconds,
    trimTargetCutIndex,
  ]);

  useEffect(() => {
    trimBoundsRef.current = {
      start: trimStartSeconds,
      end: trimEndSeconds,
      scrub: trimScrubSeconds,
    };
  }, [trimEndSeconds, trimScrubSeconds, trimStartSeconds]);

  useEffect(() => {
    if (!isTrimOpen || !trimSourceMetadata) return;
    const maxDuration = trimSourceMetadata.duration;
    if (!Number.isFinite(maxDuration) || maxDuration <= 0) return;

    const epsilon = 0.0001;
    const safeStart = clampValue(
      trimStartSeconds,
      0,
      Math.max(0, maxDuration - minTrimDurationForSource)
    );
    const safeEnd = clampValue(
      trimEndSeconds,
      safeStart + minTrimDurationForSource,
      maxDuration
    );
    const safeScrub = clampValue(trimScrubSeconds, safeStart, safeEnd);

    if (Math.abs(safeStart - trimStartSeconds) > epsilon) {
      setTrimStartSeconds(safeStart);
    }
    if (Math.abs(safeEnd - trimEndSeconds) > epsilon) {
      setTrimEndSeconds(safeEnd);
    }
    if (Math.abs(safeScrub - trimScrubSeconds) > epsilon) {
      setTrimScrubSeconds(safeScrub);
    }
  }, [
    isTrimOpen,
    minTrimDurationForSource,
    trimEndSeconds,
    trimScrubSeconds,
    trimSourceMetadata,
    trimStartSeconds,
  ]);

  useEffect(() => {
    if (!isTrimOpen || !trimSourceUrl || isTrimPlaying) return;
    const previewVideo = trimPreviewVideoRef.current;
    if (!previewVideo) return;
    const targetSeconds = clampValue(trimScrubSeconds, trimStartSeconds, trimEndSeconds);

    const seekPreview = () => {
      if (!Number.isFinite(targetSeconds) || targetSeconds < 0) return;
      try {
        previewVideo.currentTime = targetSeconds;
      } catch {
        // iOS에서는 메타데이터 로드 직후 seek가 실패할 수 있다.
      }
    };

    if (previewVideo.readyState >= 1) {
      seekPreview();
      return;
    }

    previewVideo.addEventListener('loadedmetadata', seekPreview, { once: true });
    return () => {
      previewVideo.removeEventListener('loadedmetadata', seekPreview);
    };
  }, [isTrimOpen, isTrimPlaying, trimEndSeconds, trimScrubSeconds, trimSourceUrl, trimStartSeconds]);

  useEffect(() => {
    if (!isTrimPlaying) return;
    const previewVideo = trimPreviewVideoRef.current;
    if (!previewVideo) {
      setIsTrimPlaying(false);
      return;
    }

    const tick = () => {
      const currentSeconds = previewVideo.currentTime;
      if (Number.isFinite(currentSeconds)) {
        const safeCurrent = clampValue(currentSeconds, trimStartSeconds, trimEndSeconds);
        setTrimScrubSeconds(safeCurrent);
        if (currentSeconds >= trimEndSeconds - 0.02) {
          previewVideo.pause();
          setTrimScrubSeconds(trimEndSeconds);
          setIsTrimPlaying(false);
          trimPlaybackRafRef.current = null;
          return;
        }
      }
      trimPlaybackRafRef.current = requestAnimationFrame(tick);
    };

    trimPlaybackRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (trimPlaybackRafRef.current !== null) {
        cancelAnimationFrame(trimPlaybackRafRef.current);
        trimPlaybackRafRef.current = null;
      }
    };
  }, [isTrimPlaying, trimEndSeconds, trimStartSeconds]);

  useEffect(() => {
    if (activeTrimDrag === 'none') return;

    const handlePointerMove = (event: PointerEvent) => {
      if (trimDragPointerIdRef.current !== event.pointerId || trimSliderMax <= 0) {
        return;
      }
      const dragStart = trimDragStartRef.current;
      const timeline = trimTimelineRef.current;
      if (!dragStart || !timeline) return;
      const rect = timeline.getBoundingClientRect();
      if (rect.width <= 0) return;

      const deltaSeconds =
        ((event.clientX - dragStart.pointerX) / Math.max(1, rect.width)) * trimSliderMax;

      if (activeTrimDrag === 'start') {
        const maxStart = Math.max(0, dragStart.endSeconds - minTrimDurationForSource);
        const nextStart = clampValue(dragStart.startSeconds + deltaSeconds, 0, maxStart);
        setTrimStartSeconds(nextStart);
        setTrimScrubSeconds((prev) => clampValue(prev, nextStart, dragStart.endSeconds));
        return;
      }

      if (activeTrimDrag === 'end') {
        const minEnd = dragStart.startSeconds + minTrimDurationForSource;
        const nextEnd = clampValue(dragStart.endSeconds + deltaSeconds, minEnd, trimSliderMax);
        setTrimEndSeconds(nextEnd);
        setTrimScrubSeconds((prev) => clampValue(prev, dragStart.startSeconds, nextEnd));
        return;
      }

      if (activeTrimDrag === 'window') {
        const windowDuration = Math.max(
          minTrimDurationForSource,
          dragStart.endSeconds - dragStart.startSeconds
        );
        const maxStart = Math.max(0, trimSliderMax - windowDuration);
        const nextStart = clampValue(dragStart.startSeconds + deltaSeconds, 0, maxStart);
        const nextEnd = nextStart + windowDuration;
        const scrubOffset = dragStart.scrubSeconds - dragStart.startSeconds;
        const nextScrub = clampValue(nextStart + scrubOffset, nextStart, nextEnd);
        setTrimStartSeconds(nextStart);
        setTrimEndSeconds(nextEnd);
        setTrimScrubSeconds(nextScrub);
        return;
      }

      if (activeTrimDrag === 'scrub') {
        const nextScrub = clampValue(
          timelineXToSeconds(event.clientX),
          trimBoundsRef.current.start,
          trimBoundsRef.current.end
        );
        setTrimScrubSeconds(nextScrub);
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (trimDragPointerIdRef.current !== event.pointerId) return;
      trimDragPointerIdRef.current = null;
      trimDragStartRef.current = null;
      setActiveTrimDrag('none');
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [
    activeTrimDrag,
    minTrimDurationForSource,
    timelineXToSeconds,
    trimSliderMax,
  ]);

  useEffect(() => {
    if (!isTrimOpen) {
      setTrimPreviewMaxHeight(null);
      return;
    }

    let frameId: number | null = null;

    const recalculateTrimPreviewHeight = () => {
      frameId = null;
      const viewport = trimViewportRef.current;
      const measure = trimMeasureRef.current;
      const previewContainer = trimPreviewContainerRef.current;
      if (!viewport || !measure || !previewContainer) return;

      let viewportHeight = viewport.clientHeight || window.innerHeight;
      const visualViewportHeight = window.visualViewport?.height;
      if (typeof visualViewportHeight === 'number' && Number.isFinite(visualViewportHeight)) {
        viewportHeight = Math.min(viewportHeight, visualViewportHeight);
      }

      const previewAvailableWidth =
        previewContainer.parentElement?.clientWidth || Math.max(0, measure.clientWidth - 32);
      const naturalPreviewHeight = previewAvailableWidth * (16 / 9);
      const previewHeight = previewContainer.getBoundingClientRect().height || naturalPreviewHeight;
      const fixedContentHeight = Math.max(0, measure.scrollHeight - previewHeight);
      const availablePreviewHeight = viewportHeight - 16 - fixedContentHeight;
      const nextPreviewHeight = Math.floor(
        clampValue(availablePreviewHeight, 140, naturalPreviewHeight)
      );

      setTrimPreviewMaxHeight((prev) =>
        prev !== null && Math.abs(prev - nextPreviewHeight) < 1 ? prev : nextPreviewHeight
      );
    };

    const scheduleRecalculate = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      frameId = window.requestAnimationFrame(recalculateTrimPreviewHeight);
    };

    scheduleRecalculate();
    const settleTimeoutId = window.setTimeout(scheduleRecalculate, 80);
    const lateSettleTimeoutId = window.setTimeout(scheduleRecalculate, 240);
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(scheduleRecalculate) : null;
    const observedViewport = trimViewportRef.current;
    const observedMeasure = trimMeasureRef.current;

    if (resizeObserver && observedViewport && observedMeasure) {
      resizeObserver.observe(observedViewport);
      resizeObserver.observe(observedMeasure);
    }

    const visualViewport = window.visualViewport;
    window.addEventListener('resize', scheduleRecalculate);
    window.addEventListener('orientationchange', scheduleRecalculate);
    visualViewport?.addEventListener('resize', scheduleRecalculate);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      window.clearTimeout(settleTimeoutId);
      window.clearTimeout(lateSettleTimeoutId);
      window.removeEventListener('resize', scheduleRecalculate);
      window.removeEventListener('orientationchange', scheduleRecalculate);
      visualViewport?.removeEventListener('resize', scheduleRecalculate);
      resizeObserver?.disconnect();
    };
  }, [
    isGalleryProcessing,
    isTrimOpen,
    trimError,
    trimSourceUrl,
    trimThumbnails.length,
  ]);

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
        } catch (error: unknown) {
          if (isCancelled) return;
          setFixedClipErrors((prev) => ({
            ...prev,
            [index]: getErrorMessage(error, '고정 영상을 불러오지 못했습니다.'),
          }));
        }
      }
    };

    ensureFixedClips();

    return () => {
      isCancelled = true;
    };
  }, [clips, cuts, createPosterFromClip, downloadFixedClip]);

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

  const startRecording = async (options: { replaceExisting?: boolean } = {}) => {
    if (recordingStatus === 'recording') return;
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
    if (shouldConfirmActiveRetake && !options.replaceExisting) {
      setReplacementConfirm({ type: 'recording', cutIndex: activeCutIndex });
      return;
    }

    let recordingStream =
      stream && stream.getTracks().some((track) => track.readyState === 'live')
        ? stream
        : null;
    if (!recordingStream) {
      recordingStream = await setupCamera();
    }
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
    recordingShouldAdvanceRef.current =
      !latestClipsRef.current[activeCutIndex] && !uploadedCutsRef.current[activeCutIndex];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
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
      saveClipAtIndex(
        recordedIndex,
        {
          blob,
          duration: recordedCut?.durationSeconds ?? activeCut.durationSeconds,
          mimeType,
        },
        'recording',
        recordingShouldAdvanceRef.current
      ).catch((error: unknown) => {
        const message = getErrorMessage(error, '클립 업로드에 실패했습니다.');
        setClipUploadErrors((prev) => ({
          ...prev,
          [recordedIndex]: message,
        }));
        setUploadedCuts((prev) => ({
          ...prev,
          [recordedIndex]: !recordingShouldAdvanceRef.current,
        }));
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
    setClipSources((prev) => {
      const next = { ...prev };
      delete next[activeCutIndex];
      return next;
    });
    setUploadedCuts((prev) => ({ ...prev, [activeCutIndex]: false }));
    setUploadingCuts((prev) => ({ ...prev, [activeCutIndex]: false }));
    setClipUploadErrors((prev) => {
      const next = { ...prev };
      delete next[activeCutIndex];
      return next;
    });
    setGalleryError(null);
    setRecordingStatus('idle');
    setIsResetOpen(false);
  };

  useEffect(() => {
    if (stage !== 'capture') {
      stopRecording();
      setRecordingElapsedSeconds(null);
      setEditingCaptionId(null);
      resetCaptionGesture();
      setIsMediaSourceOpen(false);
      setIsTemplateGuideOpen(false);
      setReplacementConfirm(null);
      if (isTrimOpen) {
        closeTrimModal();
      }
    }
  }, [
    closeTrimModal,
    isTrimOpen,
    resetCaptionGesture,
    setEditingCaptionId,
    stage,
    stopRecording,
  ]);

  const handleComplete = () => {
    if (!allDone) return;
    setStage('caption-edit');
  };

  const handleFinalComplete = async () => {
    if (!sessionId) return;
    if (!allDone) return;
    if (isRegisteredUser) {
      cancelScheduledSave();
      const saved = await saveDraftNow();
      if (!saved) {
        alert('최신 작업 내용을 저장하지 못했습니다. 저장을 다시 시도해 주세요.');
        return;
      }
    }

    const captionItems = captions
      .filter((caption) => caption.text.trim().length > 0)
      .map((caption) => ({
        id: caption.id,
        text: caption.text,
        source: caption.source,
        role: caption.role,
        placement: caption.placement,
        zIndex: caption.zIndex,
        style: buildCaptionExportStyle(caption.style),
      }));

    setStage('processing');

    try {
      const response = await fetch(`/api/reels-maker/sessions/${sessionId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          captionItems,
          captionsEnabled,
          acceptedStaleAutoCaptionClipIds,
        }),
      });
      const payload = (await response.json()) as
        | WebApiResponse<ReelsMakerStatusResponse>
        | ReelsMakerErrorResponse;
      if (!response.ok || !payload?.success) {
        const statusCode =
          typeof payload?.status === 'number' ? payload.status : response.status;
        const errorCode =
          payload && 'errorCode' in payload && typeof payload.errorCode === 'string'
            ? payload.errorCode
            : 'UNKNOWN';
        const backendMessage =
          typeof payload?.message === 'string' && payload.message.trim().length > 0
            ? payload.message
            : '릴스 합성이 시작되지 않았습니다.';
        console.error('[ReelsMakerCompleteStartFailed]', {
          sessionId,
          statusCode,
          errorCode,
          backendMessage,
        });
        throw new Error('REELS_COMPLETE_START_FAILED');
      }
      setFinalVideoUrl(null);
      setFinalVideoMimeType('video/mp4');
    } catch (error) {
      console.error('[ReelsMakerCompleteRequestError]', {
        sessionId,
        error,
      });
      setFinalVideoUrl((prev) => {
        revokeBlobUrl(prev);
        return null;
      });
      setFinalVideoMimeType('video/mp4');
      setFinalPosterUrl(null);
      setStage('capture');
      alert(COMPLETE_START_FAILED_USER_MESSAGE);
    }
  };

  useEffect(() => {
    if (stage !== 'processing' || !sessionId) return;

    let isCancelled = false;
    const startedAt = Date.now();

    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/reels-maker/sessions/${sessionId}/status`, {
          method: 'GET',
          cache: 'no-store',
        });
        const payload: WebApiResponse<ReelsMakerStatusResponse> = await response.json();
        if (!response.ok || !payload?.success || !payload?.data) {
          return;
        }
        const data = payload.data;
        if (isCancelled) return;
        if (data.status === 'COMPLETED') {
          setFinalVideoUrl(data.finalVideoUrl || null);
          setFinalVideoMimeType('video/mp4');
          setStage('preview');
        } else if (data.status === 'FAILED') {
          console.error('[ReelsMakerProcessingFailed]', {
            sessionId,
            processingJobId: data.processingJobId ?? null,
            errorMessage: data.errorMessage ?? null,
          });
          setStage('capture');
          alert(PROCESSING_FAILED_USER_MESSAGE);
        } else if (Date.now() - startedAt > PROCESSING_STATUS_TIMEOUT_MS) {
          console.error('[ReelsMakerProcessingTimeout]', {
            sessionId,
            elapsedMs: Date.now() - startedAt,
            lastKnownStatus: data.status,
            processingJobId: data.processingJobId ?? null,
          });
          setStage('capture');
          alert(PROCESSING_TIMEOUT_USER_MESSAGE);
        }
      } catch {
        // ignore polling errors
      }
    };

    const intervalId = window.setInterval(fetchStatus, 2000);
    fetchStatus();

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [sessionId, stage]);

  useEffect(() => {
    if (!downloadToastMessage) return;
    const timer = window.setTimeout(() => setDownloadToastMessage(null), 2000);
    return () => window.clearTimeout(timer);
  }, [downloadToastMessage]);

  useEffect(() => {
    if (isGuestUser && sessionId && stage === 'capture') {
      setShowGuestDraftNotice(true);
    }
  }, [isGuestUser, sessionId, stage]);

  const requestExit = useCallback(
    (href: string) => {
      if (recordingStatus === 'recording') {
        alert('녹화를 먼저 종료한 뒤 나가주세요.');
        return;
      }
      if (Object.values(uploadingCuts).some(Boolean)) {
        alert('영상 업로드가 완료된 뒤 나갈 수 있습니다.');
        return;
      }
      resumeAutosave();
      setPendingExitHref(href);
      setIsExitConfirmOpen(true);
    },
    [recordingStatus, resumeAutosave, uploadingCuts]
  );

  const abandonGuestSession = useCallback(async () => {
    if (!sessionId || !isGuestUser) return true;
    try {
      const response = await fetch(`/api/reels-maker/sessions/${sessionId}/abandon`, {
        method: 'POST',
      });
      return response.ok;
    } catch {
      return false;
    }
  }, [isGuestUser, sessionId]);

  const handleSaveAndExit = useCallback(async () => {
    setIsExitSaving(true);
    try {
      cancelScheduledSave();
      if (isGuestUser) {
        await abandonGuestSession();
      } else {
        const saved = await saveDraftNow();
        if (!saved) return;
      }
      setIsExitConfirmOpen(false);
      router.push(pendingExitHref);
    } finally {
      setIsExitSaving(false);
    }
  }, [
    abandonGuestSession,
    cancelScheduledSave,
    isGuestUser,
    pendingExitHref,
    router,
    saveDraftNow,
  ]);

  const handleExitWithoutSaving = useCallback(() => {
    suspendAutosave();
    setIsExitConfirmOpen(false);
    router.push(pendingExitHref);
  }, [pendingExitHref, router, suspendAutosave]);

  useEffect(() => {
    setEditingCaptionId(null);
    resetCaptionGesture();
    setGalleryError(null);
    setTrimError(null);
  }, [activeCutIndex, resetCaptionGesture, setEditingCaptionId]);

  useEffect(() => {
    const handleDeleteKey = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      const target = event.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) {
        return;
      }
      if (!resolvedSelectedCaptionId) return;
      event.preventDefault();
      deleteSelectedCaption();
    };

    window.addEventListener('keydown', handleDeleteKey);
    return () => window.removeEventListener('keydown', handleDeleteKey);
  }, [deleteSelectedCaption, resolvedSelectedCaptionId]);

  useEffect(() => {
    if (stage !== 'capture') {
      setCaptureScale(1);
      return;
    }

    let frameId: number | null = null;

    const recalculateScale = () => {
      frameId = null;
      const viewport = captureViewportRef.current;
      const content = captureContentRef.current;
      const measure = captureMeasureRef.current;
      if (!viewport || !content || !measure) return;

      const viewportWidth = viewport.clientWidth;
      let viewportHeight = viewport.clientHeight;
      const visualViewportHeight = window.visualViewport?.height;
      if (typeof visualViewportHeight === 'number' && Number.isFinite(visualViewportHeight)) {
        const visualViewportCaptureHeight = Math.max(0, visualViewportHeight);
        if (visualViewportCaptureHeight > 0) {
          viewportHeight = Math.min(viewportHeight, visualViewportCaptureHeight);
        }
      }
      const contentWidth = Math.max(measure.scrollWidth, measure.offsetWidth);
      const contentHeight = Math.max(measure.scrollHeight, measure.offsetHeight);

      if (
        viewportWidth <= 0 ||
        viewportHeight <= 0 ||
        contentWidth <= 0 ||
        contentHeight <= 0
      ) {
        return;
      }

      const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
      if (!isDesktop) {
        setCaptureScale((prev) => (Math.abs(prev - 1) < 0.001 ? prev : 1));
        return;
      }

      const fitScale = Math.min(
        1,
        viewportWidth / contentWidth,
        viewportHeight / contentHeight
      );
      const targetScale = isDesktop ? Math.min(0.85, fitScale) : fitScale;
      const safeScale = Math.max(0.35, Math.min(1, targetScale));

      setCaptureScale((prev) =>
        Math.abs(prev - safeScale) < 0.001 ? prev : safeScale
      );
    };

    const scheduleRecalculate = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      frameId = window.requestAnimationFrame(recalculateScale);
    };

    scheduleRecalculate();
    const settleTimeoutId = window.setTimeout(scheduleRecalculate, 80);
    const lateSettleTimeoutId = window.setTimeout(scheduleRecalculate, 240);
    let isDisposed = false;
    if (document.fonts?.ready) {
      document.fonts.ready
        .then(() => {
          if (!isDisposed) {
            scheduleRecalculate();
          }
        })
        .catch(() => undefined);
    }

    const viewport = captureViewportRef.current;
    const measure = captureMeasureRef.current;
    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(scheduleRecalculate)
        : null;

    if (resizeObserver && viewport && measure) {
      resizeObserver.observe(viewport);
      resizeObserver.observe(measure);
    }

    const visualViewport = window.visualViewport;
    window.addEventListener('resize', scheduleRecalculate);
    window.addEventListener('orientationchange', scheduleRecalculate);
    visualViewport?.addEventListener('resize', scheduleRecalculate);

    return () => {
      isDisposed = true;
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      window.clearTimeout(settleTimeoutId);
      window.clearTimeout(lateSettleTimeoutId);
      window.removeEventListener('resize', scheduleRecalculate);
      window.removeEventListener('orientationchange', scheduleRecalculate);
      visualViewport?.removeEventListener('resize', scheduleRecalculate);
      resizeObserver?.disconnect();
    };
  }, [stage, template?.id, cuts.length, activeCutIndex, allDone, isSessionLoading]);

  const handleDownload = () => {
    if (!finalVideoUrl) return;
    const anchor = document.createElement('a');
    const downloadUrl = `/api/reels-maker/download?url=${encodeURIComponent(finalVideoUrl)}`;
    anchor.href = downloadUrl;
    const isMp4 = finalVideoMimeType.includes('mp4');
    anchor.download = `reelstamp-reel.${isMp4 ? 'mp4' : 'webm'}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setDownloadToastMessage(isMp4 ? '다운로드 완료!' : 'MP4 미지원 브라우저로 WEBM으로 다운로드됩니다.');
  };

  const handleFinalDone = () => {
    setIsPreviewOpen(false);
    router.replace(completionReturnUrl);
  };

  const handleResetAll = () => {
    setStage('capture');
    setActiveCutIndex(0);
    setRecordingStatus('idle');
    setRecordingElapsedSeconds(null);
    setSessionId(null);
    setSessionClipMap({});
    setSessionError(null);
    setUploadedCuts(() => {
      const next: Record<number, boolean> = {};
      cuts.forEach((cut, index) => {
        next[index] = cut.isFixed;
      });
      return next;
    });
    setUploadingCuts({});
    setClipUploadErrors({});
    setCaptions([]);
    setSelectedCaptionId(null);
    setCutGuideVisibility(() => {
      const next: Record<number, boolean> = {};
      cuts.forEach((cut, index) => {
        next[index] = parseGuideImageEntries(cut.guideImageUrl).length > 0;
      });
      return next;
    });
    setGuideImageIndexByCut({});
    setEditingCaptionId(null);
    resetCaptionGesture();
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
    setClipSources((prev) => {
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
      revokeBlobUrl(finalVideoUrl);
      setFinalVideoUrl(null);
    }
    if (finalPosterUrl) {
      setFinalPosterUrl(null);
    }
    setFinalVideoMimeType('video/mp4');
    setIsPreviewOpen(false);
    setIsTemplateGuideOpen(false);
    setTemplateGuideStep('overview');
    setExampleReelIndex(0);
    setIsResetOpen(false);
    setDownloadToastMessage(null);
    setGalleryError(null);
    setIsGalleryProcessing(false);
    setIsMediaSourceOpen(false);
    setIsMediaPickerActive(false);
    setMediaPickerTargetCutIndex(null);
    setTrimTargetCutIndex(null);
    setReplacementConfirm(null);
    setIsTrimOpen(false);
    resetTrimState();
    if (templateId && requestedSessionId) {
      router.replace(
        buildReelsMakerHref({
          templateId,
          returnUrl: explicitCompletionReturnUrl,
        })
      );
    } else {
      sessionInitKeyRef.current = null;
      createReelsSession();
    }
  };

  if (!templateId) {
    return (
      <FullScreenState>
        <div className="max-w-sm text-center text-sm text-white/70">
          템플릿 선택 화면으로 이동 중입니다...
        </div>
      </FullScreenState>
    );
  }

  if (isTemplateLoading) {
    return (
      <FullScreenState>
        <div className="max-w-sm text-center text-sm text-white/70">
          템플릿 정보를 불러오는 중입니다...
        </div>
      </FullScreenState>
    );
  }

  if (templateError || !template || cuts.length === 0) {
    return (
      <FullScreenState>
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
      </FullScreenState>
    );
  }

  if (isSessionLoading) {
    return (
      <FullScreenState>
        <div className="max-w-sm text-center text-sm text-white/70">
          릴스 제작 세션을 준비하는 중입니다...
        </div>
      </FullScreenState>
    );
  }

  if (sessionError) {
    return (
      <FullScreenState>
        <div className="max-w-sm text-center space-y-4">
          <p className="text-sm leading-6 text-white/70">{sessionError.message}</p>
          <div className="space-y-3">
            {sessionError.type === 'auth' || sessionError.type === 'template-login' ? (
              <button
                type="button"
                onClick={() =>
                  router.push(
                    sessionError.type === 'template-login'
                      ? buildTemplateLoginHref()
                      : buildLoginHref(currentReelsMakerHref)
                  )
                }
                className="w-full rounded-full bg-[#FF4D6D] px-4 py-3 text-sm font-semibold text-white shadow-lg"
              >
                로그인하기
              </button>
            ) : sessionError.type === 'paid-template' ? (
              <button
                type="button"
                onClick={() => router.push(TEMPLATE_PAYMENT_PATH)}
                className="w-full rounded-full bg-[#FF4D6D] px-4 py-3 text-sm font-semibold text-white shadow-lg"
              >
                결제 페이지로 이동
              </button>
            ) : (
              <button
                type="button"
                onClick={() => createReelsSession()}
                className="w-full rounded-full bg-[#FF4D6D] px-4 py-3 text-sm font-semibold text-white shadow-lg"
              >
                다시 시도하기
              </button>
            )}
            <button
              type="button"
              onClick={() => router.replace(completionReturnUrl)}
              className="w-full rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white shadow-lg"
            >
              나가기
            </button>
          </div>
        </div>
      </FullScreenState>
    );
  }

  if (stage === 'caption-edit' && sessionId) {
    return (
      <AutoCaptionEditor
        sessionId={sessionId}
        cuts={cuts}
        clips={clips}
        clipPosters={clipPosters}
        sessionClipMap={sessionClipMap}
        captions={captions}
        setCaptions={setCaptions}
        activeCutIndex={activeCutIndex}
        setActiveCutIndex={setActiveCutIndex}
        captionsEnabled={captionsEnabled}
        setCaptionsEnabled={setCaptionsEnabled}
        autoCaptionAvailable={autoCaptionAvailable}
        remainingAttempts={
          autoCaptionJob?.remainingAttempts ?? autoCaptionRemainingAttempts
        }
        staleClipIds={
          autoCaptionJob?.staleClipIds ?? staleAutoCaptionClipIds
        }
        acceptedStaleClipIds={acceptedStaleAutoCaptionClipIds}
        job={autoCaptionJob}
        jobError={autoCaptionError}
        isProcessing={isAutoCaptionProcessing}
        isRegisteredUser={isRegisteredUser}
        loginHref={buildLoginHref(currentReelsMakerHref)}
        onStartAutoCaption={startAutoCaption}
        onAcceptStale={setAcceptedStaleAutoCaptionClipIds}
        onBack={() => setStage('capture')}
        onComplete={() => void handleFinalComplete()}
        handleFrameRef={handleCameraFrameRef}
        captionStageRef={captionStageRef}
        captionOverlayRef={captionOverlayRef}
        captionInputRef={captionInputRef}
        captionPreviewScale={captionPreviewScale}
        selectedCaptionId={resolvedSelectedCaptionId}
        editingCaptionId={editingCaptionId}
        setSelectedCaptionId={setSelectedCaptionId}
        setEditingCaptionId={setEditingCaptionId}
        onCaptionPointerDown={handleCaptionPointerDown}
        onCaptionPointerMove={handleCaptionPointerMove}
        onCaptionPointerEnd={handleCaptionPointerEnd}
        onResizePointerDown={handleResizeHandlePointerDown}
        onResizePointerMove={handleResizeHandlePointerMove}
        onResizePointerEnd={handleResizeHandlePointerEnd}
        onCaptionTextChange={handleCaptionTextChange}
        onToggleBox={handleCaptionToggleBox}
      />
    );
  }

  if (stage === 'processing') {
    return <ProcessingView />;
  }

  if (stage === 'preview') {
    return (
      <FinalPreview
        finalVideoUrl={finalVideoUrl}
        finalVideoMimeType={finalVideoMimeType}
        finalPosterUrl={finalPosterUrl}
        templateTitle={template.title}
        downloadToastMessage={downloadToastMessage}
        isPreviewOpen={isPreviewOpen}
        onOpenPreview={() => setIsPreviewOpen(true)}
        onClosePreview={() => setIsPreviewOpen(false)}
        onDownload={handleDownload}
        onDone={handleFinalDone}
        onReset={handleResetAll}
        onShared={setDownloadToastMessage}
      />
    );
  }

  return (
    <div
      className="overflow-hidden bg-[#1E2A3B] text-white lg:flex lg:flex-col lg:bg-black"
      style={{
        height: '100dvh',
        minHeight: '100vh',
      }}
    >
      {showRecommendedTimingToast && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed left-1/2 z-[60] w-full max-w-md -translate-x-1/2 px-4"
          style={{ top: 'calc(12px + env(safe-area-inset-top, 0px))' }}
        >
          <div className="rounded-xl border border-rose-300/70 bg-rose-600 px-4 py-3 text-sm font-bold text-white shadow-2xl motion-safe:animate-pulse">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <p>이 포맷은 이 시간 내에 마무리하는 것을 추천합니다.</p>
            </div>
          </div>
        </div>
      )}
      <input
        ref={galleryFileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleGalleryFileChange}
      />
      {showGuestDraftNotice && isGuestUser && (
        <GuestDraftNotice
          loginHref={buildLoginHref(currentReelsMakerHref)}
          onContinue={() => setShowGuestDraftNotice(false)}
        />
      )}
      {isExitConfirmOpen && (
        <ExitConfirmModal
          isGuestUser={isGuestUser}
          isSaving={isExitSaving}
          onSaveAndExit={() => void handleSaveAndExit()}
          onExitWithoutSaving={handleExitWithoutSaving}
          onContinue={() => setIsExitConfirmOpen(false)}
        />
      )}
      {isCaptureMenuOpen && (
        <CaptureMenu
          user={user}
          isAuthenticated={isAuthenticated}
          isAdmin={isAdmin}
          isGuestUser={isGuestUser}
          isRegisteredUser={isRegisteredUser}
          loginHref={buildLoginHref(currentReelsMakerHref)}
          buildLoginHref={buildLoginHref}
          onClose={() => setIsCaptureMenuOpen(false)}
          onRequestExit={requestExit}
        />
      )}
      {isMediaSourceOpen && mediaPickerTargetCutIndex !== null && (
        <CutMediaSourceModal
          isBusy={isMediaPickerActive || isGalleryProcessing || isTrimPreparing}
          onClose={closeCutMediaSource}
          onSelectVideoCapture={() => selectVideoCaptureModeForIndex(mediaPickerTargetCutIndex)}
          onSelectGallery={() => void openGalleryPickerForIndex(mediaPickerTargetCutIndex)}
        />
      )}
      {replacementConfirm && (
        <RetakeConfirmModal
          title={
            replacementConfirm.type === 'gallery'
              ? '파일로 교체할까요?'
              : '다시 촬영할까요?'
          }
          description={
            replacementConfirm.type === 'gallery'
              ? '촬영된 영상은 새 파일이 저장되면 교체됩니다.'
              : '현재 컷의 기존 영상은 새 촬영이 저장되면 교체됩니다.'
          }
          confirmLabel={
            replacementConfirm.type === 'gallery' ? '파일 선택' : '다시 촬영'
          }
          onCancel={() => setReplacementConfirm(null)}
          onConfirm={() => {
            const { cutIndex, type } = replacementConfirm;
            setReplacementConfirm(null);
            setActiveCutIndex(cutIndex);
            if (type === 'gallery') {
              void openGalleryPickerForIndex(cutIndex, {
                skipReplacementConfirm: true,
              });
              return;
            }
            void startRecording({ replaceExisting: true });
          }}
        />
      )}
      <header className="hidden h-[72px] shrink-0 grid-cols-[96px_minmax(0,1fr)_96px] items-center border-b border-[#263244] bg-[#111827] px-12 text-[#F8FAFC] lg:grid">
        <button
          type="button"
          onClick={() => requestExit(completionReturnUrl)}
          className="flex h-10 w-10 items-center justify-center rounded-full text-[#CBD5E1] transition hover:bg-white/10 hover:text-white"
          aria-label="뒤로가기"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-center text-xl font-bold">릴스 제작</h1>
        <button
          type="button"
          onClick={() => setIsCaptureMenuOpen(true)}
          className="justify-self-end flex h-10 w-10 items-center justify-center rounded-full text-[#CBD5E1] transition hover:bg-white/10 hover:text-white"
          aria-label="메뉴"
        >
          <Menu className="h-6 w-6" />
        </button>
      </header>
      <div
        ref={captureViewportRef}
        className="h-full w-full overflow-hidden lg:mx-auto lg:h-auto lg:min-h-0 lg:max-w-[440px] lg:flex-1"
        style={{
          boxSizing: 'border-box',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="flex h-full w-full items-stretch justify-stretch overflow-hidden lg:items-center lg:justify-center">
          <div
            ref={captureContentRef}
            className="h-full w-full shrink-0 origin-center self-stretch lg:h-auto lg:self-center"
            style={{
              transform: `scale(${captureScale})`,
              transformOrigin: 'center center',
            }}
          >
            <div ref={captureMeasureRef} className="mx-auto flex h-full w-full flex-col p-0 lg:block lg:h-auto lg:px-4 lg:pt-6 lg:pb-10">
              <div className="mb-3 hidden lg:block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                모바일 웹앱에서 촬영하면 더 안정적으로 카메라를 사용할 수 있어요.
              </div>

              <div className="relative flex h-full w-full flex-col overflow-hidden rounded-none bg-[#1E2A3B] p-0 shadow-none lg:h-auto lg:rounded-[28px] lg:p-4 lg:shadow-2xl">
                <div className="mb-0 flex h-16 shrink-0 items-center gap-2 px-3 lg:mb-3 lg:h-auto lg:px-1">
                  <button
                    type="button"
                    onClick={() => requestExit('/templates')}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/90 transition hover:bg-white/10 lg:hidden"
                    aria-label="뒤로가기"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      {isRegisteredUser ? (
                        <input
                          value={projectName}
                          onChange={(event) => setProjectName(event.target.value.slice(0, 50))}
                          onBlur={() => {
                            if (!projectName.trim()) {
                              setProjectName(`${template.title || '릴스'} 프로젝트`);
                            }
                          }}
                          aria-label="프로젝트 이름"
                          className="min-w-0 flex-1 truncate border-0 bg-transparent text-sm font-semibold text-white/90 outline-none placeholder:text-white/45"
                          placeholder="프로젝트 이름"
                        />
                      ) : (
                        <span className="truncate text-sm font-semibold text-white/80">릴스 제작</span>
                      )}
                      {recordingStatus === 'recording' && (
                        <span className="inline-flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#FF4D6D] px-2.5 text-[11px] font-semibold">
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                          REC
                        </span>
                      )}
                    </div>
                    {isRegisteredUser && (
                      <button
                        type="button"
                        onClick={() => {
                          if (draftSaveStatus === 'error') void saveDraftNow();
                        }}
                        className={`mt-0.5 block text-[10px] ${
                          draftSaveStatus === 'error'
                            ? 'text-rose-300 underline'
                            : 'text-white/50'
                        }`}
                      >
                        {draftSaveStatus === 'saving'
                          ? '저장 중...'
                          : draftSaveStatus === 'error'
                            ? '저장 실패 · 다시 시도'
                            : lastSavedAt
                              ? `자동 저장됨 · ${new Date(lastSavedAt).toLocaleTimeString('ko-KR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}`
                              : '자동 저장 준비 중'}
                      </button>
                    )}
                    {isGuestUser && (
                      <p className="mt-0.5 text-[10px] text-amber-200/90">
                        게스트 작업은 중간 저장되지 않습니다.
                      </p>
                    )}
                  </div>
                  {canOpenActiveCutGuide && (
                    <button
                      type="button"
                      onClick={() => {
                        setTemplateGuideStep(activeCutIndex);
                        setIsTemplateGuideOpen(true);
                      }}
                      className="h-10 shrink-0 rounded-full bg-[#FF4D6D] px-4 text-xs font-semibold shadow-lg"
                    >
                      가이드 보기
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsCaptureMenuOpen(true)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/90 transition hover:bg-white/10 lg:hidden"
                    aria-label="메뉴"
                  >
                    <Menu className="h-6 w-6" />
                  </button>
                </div>

                <div
                  ref={handleCameraFrameRef}
                  className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden rounded-none bg-[#243246] lg:aspect-[9/16] lg:flex-none lg:rounded-[24px]"
                  onPointerDownCapture={(event) => {
                    if (!editingCaptionId) return;
                    const targetNode = event.target as Node;
                    if (captionOverlayRef.current?.contains(targetNode)) return;
                    setEditingCaptionId(null);
                  }}
                >
                  {isActiveCutFixed ? (
                    activeFixedError ? (
                      <div className="space-y-3 px-6 text-center text-sm text-white/70">
                        <p>{activeFixedError}</p>
                        <button
                          type="button"
                          onClick={() => retryFixedClip(activeCutIndex)}
                          className="h-10 rounded-full bg-white/10 px-4 text-xs text-white/80"
                        >
                          다시 불러오기
                        </button>
                      </div>
                    ) : activeClip ? (
                      <FixedClipVideo
                        key={activeClip.url}
                        clipUrl={activeClip.url}
                        posterUrl={clipPosters[activeCutIndex] || undefined}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <div className="px-6 text-center text-sm text-white/70">
                        고정 영상을 불러오는 중입니다...
                      </div>
                    )
                  ) : activeUploadError ? (
                    <div className="space-y-3 px-6 text-center text-sm text-white/70">
                      <p>{activeUploadError}</p>
                      <button
                        type="button"
                        onClick={handleResetCut}
                        className="h-10 rounded-full bg-white/10 px-4 text-xs text-white/80"
                      >
                        다시 촬영하기
                      </button>
                    </div>
                  ) : shouldShowActiveClipPreview && activeClip ? (
                    <CapturedClipPreview
                      key={activeClip.url}
                      clipUrl={activeClip.url}
                      posterUrl={clipPosters[activeCutIndex] || undefined}
                    />
                  ) : cameraError ? (
                    <div className="px-6 text-center text-sm text-white/70">{cameraError}</div>
                  ) : (
                    <>
                      <CameraPreviewVideo
                        stream={stream}
                        className="absolute inset-0 h-full w-full"
                        onPreviewMetrics={handleCameraPreviewMetrics}
                      />
                      {guideImageSrc && isGuideImageVisible && (
                        <>
                          <img
                            key={guideImageSrc}
                            src={guideImageSrc}
                            alt="가이드 이미지"
                            className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-70"
                          />
                          {hasMultipleGuideImages && (
                            <div className="absolute inset-x-0 bottom-4 z-30 flex items-center justify-center gap-3">
                              <button
                                type="button"
                                onClick={handlePrevGuideImage}
                                disabled={isGuideImageNavigationDisabled || activeGuideImageIndex <= 0}
                                className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-35"
                                aria-label="이전 가이드 이미지"
                              >
                                <ChevronLeft className="h-5 w-5" />
                              </button>
                              <span className="min-w-[52px] rounded-full bg-black/55 px-3 py-2 text-center text-xs font-semibold text-white shadow-lg">
                                {activeGuideImageIndex + 1} / {guideImageCount}
                              </span>
                              <button
                                type="button"
                                onClick={handleNextGuideImage}
                                disabled={
                                  isGuideImageNavigationDisabled ||
                                  activeGuideImageIndex >= guideImageCount - 1
                                }
                                className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-35"
                                aria-label="다음 가이드 이미지"
                              >
                                <ChevronRight className="h-5 w-5" />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                      {!stream && (
                        <div className="relative text-center text-white/40">
                          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full border border-white/20">
                            <Camera className="h-6 w-6 text-white/60" />
                          </div>
                          카메라 뷰
                        </div>
                      )}
                    </>
                  )}

                  {showCaptionStage && (
                    <CaptionOverlayStage
                      captions={activeCaptions}
                      selectedCaptionId={resolvedSelectedCaptionId}
                      editingCaptionId={editingCaptionId}
                      previewScale={captionPreviewScale}
                      stageRef={captionStageRef}
                      overlayRef={captionOverlayRef}
                      inputRef={captionInputRef}
                      onSelect={setSelectedCaptionId}
                      onEdit={setEditingCaptionId}
                      onTextChange={handleCaptionTextChange}
                      onCaptionPointerDown={handleCaptionPointerDown}
                      onCaptionPointerMove={handleCaptionPointerMove}
                      onCaptionPointerEnd={handleCaptionPointerEnd}
                      onResizePointerDown={handleResizeHandlePointerDown}
                      onResizePointerMove={handleResizeHandlePointerMove}
                      onResizePointerEnd={handleResizeHandlePointerEnd}
                    />
                  )}

                  <div className="pointer-events-none absolute inset-x-0 top-0 z-30 space-y-2 bg-gradient-to-b from-black/35 via-black/10 to-transparent px-3 pb-6 pt-3">
                    <div className="pointer-events-auto">
                      <div className="grid grid-cols-2 gap-2">
                        {shouldShowGuideImageToggle && (
                          <button
                            type="button"
                            onClick={handleGuideImageToggle}
                            className="h-10 min-w-0 w-full rounded-full border border-white/35 bg-white/15 px-2 text-[11px] leading-none font-semibold text-white whitespace-nowrap"
                          >
                            가이드 이미지 {isGuideImageVisible ? 'ON' : 'OFF'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={addCaptionToActiveClip}
                          disabled={
                            !showCaptionStage ||
                            activeClipId == null ||
                            activeOverlayCaptionCount >= MAX_CAPTIONS_PER_CLIP
                          }
                          className="flex h-10 min-w-0 w-full items-center justify-center gap-1 rounded-full border border-white/35 bg-white/15 px-2 text-[11px] leading-none font-semibold text-white whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          자막 추가 {activeOverlayCaptionCount}/{MAX_CAPTIONS_PER_CLIP}
                        </button>
                        <button
                          type="button"
                          onClick={handleCaptionToggleBox}
                          disabled={!showCaptionOverlay}
                          className="h-10 min-w-0 w-full rounded-full border border-white/35 bg-white/15 px-2 text-[11px] leading-none font-semibold text-white whitespace-nowrap disabled:opacity-40"
                        >
                          텍스트 박스 {activeCaptionStyle.boxed ? 'ON' : 'OFF'}
                        </button>
                        <button
                          type="button"
                          onClick={deleteSelectedCaption}
                          disabled={!resolvedSelectedCaptionId}
                          className={`flex h-10 min-w-0 w-full items-center justify-center gap-1 rounded-full border border-white/35 bg-white/15 px-2 text-[11px] leading-none font-semibold text-white whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40 ${
                            shouldShowGuideImageToggle ? '' : 'col-span-2'
                          }`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          선택 자막 삭제
                        </button>
                      </div>
                    </div>

                    {isActiveCutFixed && (
                      <p className="rounded-lg bg-black/35 px-3 py-1.5 text-center text-[11px] text-white/80">
                        고정 영상 컷입니다. 촬영 없이 자동으로 완료됩니다.
                      </p>
                    )}
                  </div>

                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/35 via-black/10 to-transparent px-3 pb-4 pt-20">
                    <div className="pointer-events-auto space-y-3">
                      <div className="flex items-end justify-center gap-2">
                        {cuts.map((cut, index) => {
                          const clip = clips[index];
                          const isActive = index === activeCutIndex;
                          const isUploadingCut = uploadingCuts[index];
                          const shouldShowMediaPlus =
                            !cut.isFixed && !fixedClipErrors[index] && (!clip || isActive);
                          const isMediaPlusDisabled = Boolean(
                            isUploadingCut || isMediaImportBlocked
                          );
                          return (
                            <div
                              key={cut.id}
                              className={`relative h-[92px] w-[52px] overflow-hidden rounded-xl border-2 transition-all ${
                                isActive ? 'border-[#FF4D6D] bg-white/10' : 'border-white/15 bg-black/30'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  if (fixedClipErrors[index]) {
                                    retryFixedClip(index);
                                    return;
                                  }
                                  if (recordingStatus === 'recording') return;
                                  setActiveCutIndex(index);
                                }}
                                className="absolute inset-0 z-0"
                                aria-label={`${index + 1}번 컷 선택`}
                              >
                                {clip ? (
                                  <video
                                    src={clip.url}
                                    muted
                                    playsInline
                                    preload="metadata"
                                    poster={clipPosters[index] || undefined}
                                    className="absolute inset-0 h-full w-full object-cover"
                                  />
                                ) : (
                                  <span className="absolute inset-0 bg-transparent" />
                                )}
                                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-white/85">
                                  {cut.label}
                                </span>
                                {clip && (
                                  <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                                    <Check className="h-3 w-3" />
                                  </span>
                                )}
                                {cut.isFixed && !clip && !fixedClipErrors[index] && (
                                  <span className="absolute left-1.5 top-1.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] text-white/75">
                                    고정
                                  </span>
                                )}
                                {fixedClipErrors[index] && (
                                  <span className="absolute left-1.5 top-1.5 rounded-full bg-rose-500/80 px-1.5 py-0.5 text-[10px] text-white">
                                    오류
                                  </span>
                                )}
                              </button>
                              {shouldShowMediaPlus && (
                                <button
                                  type="button"
                                  onClick={() => openCutMediaSource(index)}
                                  disabled={isMediaPlusDisabled}
                                  className="absolute left-1/2 top-1/2 z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white shadow-lg backdrop-blur transition-all hover:scale-105 hover:border-white/40 hover:bg-black/65 hover:shadow-[0_0_0_2px_rgba(255,255,255,0.12),0_6px_14px_rgba(0,0,0,0.38)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:scale-100 disabled:hover:border-white/20 disabled:hover:bg-black/45 disabled:hover:shadow-lg"
                                  aria-label={`${index + 1}번 컷 미디어 추가`}
                                >
                                  {isUploadingCut ? (
                                    <Loader2 className="h-5 w-5 animate-spin text-white/70" />
                                  ) : (
                                    <Plus className="h-5 w-5 text-white/75" />
                                  )}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="space-y-2">
                        <div className="grid grid-cols-3 items-center">
                          <div className="flex justify-start">
                            {allDone ? (
                              <button
                                type="button"
                                onClick={() => setIsResetOpen(true)}
                                disabled={recordingStatus === 'recording'}
                                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/35 bg-black/35 text-white/80 disabled:cursor-not-allowed disabled:opacity-45"
                                aria-label="촬영 다시 시도"
                              >
                                <RotateCcw className="h-5 w-5" />
                              </button>
                            ) : (
                              <div className="h-12 w-12" aria-hidden />
                            )}
                          </div>
                          <div className="flex justify-center">
                            <button
                              type="button"
                              onClick={() => {
                                if (recordingStatus === 'recording') {
                                  stopRecording();
                                  return;
                                }
                                void startRecording();
                              }}
                              disabled={isRecordDisabled}
                              className={`relative flex h-20 w-20 items-center justify-center rounded-full border-4 shadow-2xl ${
                                isRecordDisabled ? 'border-white/20' : 'border-[#FF4D6D]'
                              }`}
                              aria-label={
                                shouldConfirmActiveRetake ? '현재 컷 다시 촬영' : '현재 컷 촬영'
                              }
                            >
                              <span
                                className={`transition-all ${
                                  recordingStatus === 'recording'
                                    ? 'h-8 w-8 rounded-lg bg-[#FF4D6D]'
                                    : 'h-12 w-12 rounded-full bg-white'
                                }`}
                              />
                            </button>
                          </div>
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={handleSwitchCamera}
                              disabled={isSwitchCameraDisabled}
                              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/35 bg-black/35 disabled:cursor-not-allowed disabled:opacity-45"
                              aria-label="전면/후면 카메라 전환"
                            >
                              <SwitchCamera className="h-5 w-5 text-white/80" />
                            </button>
                          </div>
                        </div>
                        {allDone && (
                          <button
                            type="button"
                            onClick={handleComplete}
                            disabled={
                              recordingStatus === 'recording' ||
                              isUploadingActiveCut ||
                              isGalleryProcessing ||
                              isTrimPreparing ||
                              isTrimOpen ||
                              isMediaPickerActive
                            }
                            className="h-11 w-full rounded-full bg-[#FF4D6D] px-4 text-sm font-semibold shadow-lg disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            ✓ 완료하기
                          </button>
                        )}
                        {(galleryError || trimError) && (
                          <p className="text-center text-xs text-rose-300">{galleryError || trimError}</p>
                        )}
                      </div>

                      {recordingElapsedSeconds !== null && (
                        <div className="text-center">
                          <p
                            className={`text-sm ${
                              activeCutDurationMode === DURATION_MODE_RECOMMENDED &&
                              isRecommendedTimingExceeded
                                ? 'font-semibold text-rose-400'
                                : 'text-white/75'
                            }`}
                          >
                            {activeCutDurationMode === DURATION_MODE_FORCED
                              ? `${forcedRemainingSeconds}s 남음`
                              : `${elapsedSeconds}s 경과`}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isTemplateGuideOpen && template && (
        <TemplateGuideModal
          templateTitle={template.title}
          templateOverview={template.subtitle}
          cuts={cuts}
          step={templateGuideStep}
          exampleReels={exampleReels}
          currentReelIndex={exampleReelIndex}
          onClose={() => setIsTemplateGuideOpen(false)}
          onSelectStep={setTemplateGuideStep}
          onPrimaryAction={handleTemplateGuidePrimaryAction}
          onSelectReel={setExampleReelIndex}
        />
      )}

      {isTrimOpen && (
        <TrimModal
          viewportRef={trimViewportRef}
          measureRef={trimMeasureRef}
          previewContainerRef={trimPreviewContainerRef}
          previewVideoRef={trimPreviewVideoRef}
          timelineRef={trimTimelineRef}
          sourceUrl={trimSourceUrl}
          sourceFile={trimSourceFile}
          sourceMetadata={trimSourceMetadata}
          previewMaxHeight={trimPreviewMaxHeight}
          isPlaying={isTrimPlaying}
          thumbnails={trimThumbnails}
          sliderMax={trimSliderMax}
          startSeconds={trimStartSeconds}
          endSeconds={trimEndSeconds}
          scrubSeconds={trimScrubSeconds}
          durationSeconds={trimDurationSeconds}
          recommendedSeconds={recommendedTrimSeconds}
          activeDrag={activeTrimDrag}
          error={trimError}
          isProcessing={isGalleryProcessing}
          onClose={closeTrimModal}
          onPlayToggle={() => void handleTrimPlayToggle()}
          onScrubPointerDown={handleTrimScrubPointerDown}
          onPointerDown={handleTrimPointerDown}
          secondsToTimelineX={secondsToTimelineX}
          onConfirm={() => void handleTrimConfirm()}
        />
      )}

      {isResetOpen && (
        <ResetCutModal
          onCancel={() => setIsResetOpen(false)}
          onConfirm={handleResetCut}
        />
      )}
    </div>
  );
}

export default function ReelsMakerPage() {
  return (
    <Suspense fallback={null}>
      <ReelsMakerInner />
    </Suspense>
  );
}
