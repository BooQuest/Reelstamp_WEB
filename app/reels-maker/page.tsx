'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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
} from 'lucide-react';
import type { WebApiResponse } from '@/app/lib/api/auth';
import { useAuth } from '@/app/components/providers/AuthProvider';
import { USER_ROLES } from '@/app/lib/constants/auth';
import CaptureActionControls from '@/app/reels-maker/components/CaptureActionControls';
import CaptureCaptionMenu from '@/app/reels-maker/components/CaptureCaptionMenu';
import CaptureFlowAction from '@/app/reels-maker/components/CaptureFlowAction';
import CaptureMenu from '@/app/reels-maker/components/CaptureMenu';
import AutoCaptionEditor from '@/app/reels-maker/components/AutoCaptionEditor';
import CaptionEditDecisionModal from '@/app/reels-maker/components/CaptionEditDecisionModal';
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
import useCameraCapture from './hooks/useCameraCapture';
import useGalleryImport from './hooks/useGalleryImport';
import useVideoTrim from './hooks/useVideoTrim';
import useClipLibrary from './hooks/useClipLibrary';
import { revokeBlobUrl } from './utils/media/previews';
import useCaptionEditor from '@/app/reels-maker/hooks/useCaptionEditor';
import useAutoCaption from '@/app/reels-maker/hooks/useAutoCaption';
import useDraftAutosave from '@/app/reels-maker/hooks/useDraftAutosave';
import {
  formatDurationSeconds,
  formatDurationSecondsLabel,
} from '@/app/reels-maker/utils/duration';
import {
  AUTO_CAPTION_DEFAULT_STYLE,
  COMPLETE_START_FAILED_USER_MESSAGE,
  DEFAULT_CAPTION_STYLE,
  DURATION_MODE_FORCED,
  DURATION_MODE_RECOMMENDED,
  MAX_CAPTIONS_PER_CLIP,
  PROCESSING_FAILED_USER_MESSAGE,
  PROCESSING_STATUS_TIMEOUT_MS,
  PROCESSING_TIMEOUT_USER_MESSAGE,
} from '@/app/reels-maker/constants';
import type {
  CaptionItem,
  ClipSource,
  PreparedClip,
  ReelsMakerErrorResponse,
  ReelsMakerSessionResponse,
  ReelsMakerStatusResponse,
  Stage,
  TemplateDetailResponse,
  TemplateExampleReel,
} from '@/app/reels-maker/types';
import {
  parseGuideImageEntries,
} from '@/app/reels-maker/utils/assets';
import {
  buildCaptionExportStyle,
  normalizeCaptionText,
  normalizeCaptionStyle,
} from '@/app/reels-maker/utils/captions';
import type { CameraPreviewMetrics } from '@/app/reels-maker/utils/camera';
import { getErrorMessage } from '@/app/reels-maker/utils/errors';
import {
  buildTemplateLoginHref,
  isComingSoonTemplate,
  PAID_TEMPLATE_REQUIRED_ERROR_CODE,
  TEMPLATE_LOGIN_REQUIRED_ERROR_CODE,
  TEMPLATE_LOGIN_REQUIRED_MESSAGE,
  TEMPLATE_NOT_AVAILABLE_MESSAGE,
  TEMPLATE_PAYMENT_PATH,
} from '@/app/lib/templates/access';
import { isReelstampBetaEnabled } from '@/app/lib/constants/beta';

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

type ReplacementConfirmState =
  | {
      type: 'recording' | 'gallery';
      cutIndex: number;
    }
  | null;

type FinalCompleteOptions = {
  acceptedStaleAutoCaptionClipIds?: number[];
};

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
      text: normalizeCaptionText(caption.text, {
        restoreEscapedNewlines: true,
      }),
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

  const captureViewportRef = useRef<HTMLDivElement | null>(null);
  const captureContentRef = useRef<HTMLDivElement | null>(null);
  const captureMeasureRef = useRef<HTMLDivElement | null>(null);

  const sessionHydratedRef = useRef(false);
  const sessionInitKeyRef = useRef<string | null>(null);

  const [stage, setStage] = useState<Stage>('capture');

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

  const [activeCutIndex, setActiveCutIndex] = useState(0);

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
  const [isCaptionEditDecisionOpen, setIsCaptionEditDecisionOpen] =
    useState(false);
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

  const [isMediaSourceOpen, setIsMediaSourceOpen] = useState(false);

  const [mediaPickerTargetCutIndex, setMediaPickerTargetCutIndex] = useState<number | null>(
    null
  );

  const [replacementConfirm, setReplacementConfirm] =
    useState<ReplacementConfirmState>(null);

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
      const durationLabel = formatDurationSecondsLabel(duration);
      return {
        id: `${template.id}-cut-${order}`,
        order,
        durationSeconds: duration,
        durationMode: isFixed ? null : durationMode,
        label: isFixed
          ? durationLabel
          : `${durationLabel} [${durationMode === DURATION_MODE_FORCED ? '강제' : '권장'}]`,
        guideText: cut.guideText ?? cut['guide_text'] ?? '',
        guideImageUrl: cut.guideImageUrl ?? cut['guide_image_url'] ?? null,
        exampleImageUrl: cut.exampleImageUrl ?? null,
        exampleVideoUrl: cut.exampleVideoUrl ?? null,
        defaultCaption: normalizeCaptionText(cut.defaultCaption, {
          restoreEscapedNewlines: true,
        }),
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

  const {
    clips, clipSources, clipPosters, uploadedCuts, uploadingCuts, clipUploadErrors, fixedClipErrors,
    save: saveClip, hydrate: hydrateClips, reset: resetClips, resetCut, retryFixedClip, reportUploadError,
  } = useClipLibrary({ cuts, sessionId, sessionClipMap });
  const trim = useVideoTrim({ cuts, activeCutIndex, onSubmit: saveClipAtIndex, logVideoDebug });
  const {
    isTrimOpen, isTrimPreparing, trimSourceFile, trimSourceUrl, trimSourceMetadata,
    trimStartSeconds, trimEndSeconds, trimScrubSeconds, isTrimPlaying, activeTrimDrag,
    trimPreviewMaxHeight, trimThumbnails, trimError, trimDurationSeconds, trimSliderMax,
    recommendedTrimSeconds, trimViewportRef, trimMeasureRef, trimPreviewContainerRef,
    trimPreviewVideoRef, trimTimelineRef, closeTrimModal, handleTrimPlayToggle,
    handleTrimScrubPointerDown, handleTrimPointerDown, secondsToTimelineX, handleTrimConfirm,
    reset: resetTrimState, clearError: clearTrimError,
  } = trim;
  const gallery = useGalleryImport({
    cuts, activeCutIndex, onSelectCut: setActiveCutIndex,
    onBeforePick: () => stopCamera(), onOpenVideo: trim.open,
    onSubmit: saveClipAtIndex, logVideoDebug,
  });
  const {
    galleryFileInputRef, galleryError, isMediaPickerActive, handleGalleryFileChange,
    reset: resetGallery, clearError: clearGalleryError, open: openGallery,
  } = gallery;
  const isGalleryProcessing = gallery.isGalleryProcessing || trim.isProcessing;
  const isCaptureCameraPaused =
    !sessionId || isSessionLoading || isTemplateGuideOpen || isMediaPickerActive ||
    isGalleryProcessing || isTrimPreparing || isTrimOpen;
  const camera = useCameraCapture({
    cuts, activeCutIndex, sessionId, sessionClipMap,
    previewActive: stage === 'capture' && Boolean(template) && !isCaptureCameraPaused,
    switchDisabled: Boolean(cuts[activeCutIndex]?.isFixed) || isGalleryProcessing || isTrimPreparing || isTrimOpen || isMediaPickerActive,
    shouldConfirmRetake: clipSources[activeCutIndex] === 'recording',
    onRequestReplacement: (cutIndex) => setReplacementConfirm({ type: 'recording', cutIndex }),
    onSubmit: saveClipAtIndex, onUploadError: reportUploadError, logVideoDebug,
  });
  const {
    stream, cameraError, recordingStatus, recordingElapsedSeconds,
    startRecording, stopRecording, stopCamera, handleSwitchCamera,
    reset: resetCamera, clearError: clearCameraError,
  } = camera;

  async function saveClipAtIndex(index: number, clip: PreparedClip, source: ClipSource) {
    const { session, clipId, nextCutIndex } = await saveClip(index, clip, source);
    applyServerUpdate(session);
    setCaptionsEnabled(session.captionsEnabled !== false);
    setAutoCaptionAvailable(Boolean(session.autoCaptionAvailable));
    setAutoCaptionRemainingAttempts(session.autoCaptionRemainingAttempts ?? 0);
    setActiveAutoCaptionJobId(session.activeAutoCaptionJobId ?? null);
    setLatestAutoCaptionJobId(session.latestAutoCaptionJobId ?? null);
    setStaleAutoCaptionClipIds(session.staleAutoCaptionClipIds ?? []);
    setAcceptedStaleAutoCaptionClipIds((current) => current.filter((id) => id !== clipId));
    clearGalleryError();
    clearCameraError();
    if (nextCutIndex >= 0) {
      setActiveCutIndex(nextCutIndex);
      setTemplateGuideStep(nextCutIndex);
      setIsTemplateGuideOpen(true);
    }
  }

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
    handleCaptionScaleChange,
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
  const currentStaleAutoCaptionClipIds =
    autoCaptionJob?.staleClipIds ?? staleAutoCaptionClipIds;
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
  const hasUploadingCut = Object.values(uploadingCuts).some(Boolean);
  const captureFlowAction: 'complete' | null = allDone ? 'complete' : null;
  const isCaptureFlowActionDisabled =
    recordingStatus === 'recording' ||
    isSessionLoading ||
    !sessionId ||
    hasUploadingCut ||
    isGalleryProcessing ||
    isTrimPreparing ||
    isTrimOpen ||
    isMediaPickerActive;
  const isGalleryButtonDisabled =
    !activeCut ||
    isActiveCutFixed ||
    isMediaImportBlocked ||
    Boolean(uploadingCuts[activeCutIndex]);
  const canRetakeActiveCut =
    !isActiveCutFixed && Boolean(activeClip) && recordingStatus !== 'recording';

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
        if (isComingSoonTemplate(data)) {
          throw new Error(TEMPLATE_NOT_AVAILABLE_MESSAGE);
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

      const restored = await hydrateClips(session, Boolean(requestedSessionId));
      if (!restored) return;
      const restoredIndex = cuts.findIndex(
        (cut) => cut.order === session.lastActiveClipOrder
      );
      const resolvedActiveIndex = restoredIndex >= 0 ? restoredIndex : 0;
      if (requestedSessionId) {
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
    hydrateClips,
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
    if (cuts.length === 0) return;

    setActiveCutIndex(0);
    resetCamera();
    setSessionId(null);
    setSessionClipMap({});
    setSessionError(null);
    resetDraft();
    sessionHydratedRef.current = false;
    resetClips(cuts);
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
    setFinalVideoUrl((prev) => {
      revokeBlobUrl(prev);
      return null;
    });
    setFinalPosterUrl(null);
    setFinalVideoMimeType('video/mp4');
    setIsPreviewOpen(false);
    setIsMediaSourceOpen(false);
    setMediaPickerTargetCutIndex(null);
    setReplacementConfirm(null);
    setIsTemplateGuideOpen(false);
    setTemplateGuideStep('overview');
    resetGallery();
    resetTrimState();
  }, [
    template?.id,
    cuts,
    resetCaptionGesture,
    resetDraft,
    resetTrimState,
    resetGallery,
    resetCamera,
    resetClips,
    setEditingCaptionId,
    setSelectedCaptionId,
  ]);

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
      clearGalleryError();
      clearTrimError();

      if (
        clipSources[targetIndex] === 'recording' &&
        !options.skipReplacementConfirm
      ) {
        setReplacementConfirm({ type: 'gallery', cutIndex: targetIndex });
        return;
      }

      setMediaPickerTargetCutIndex(targetIndex);
      await openGallery(targetIndex);
    },
    [clipSources, cuts, openGallery, isMediaImportBlocked, uploadingCuts, clearGalleryError, clearTrimError]
  );

  const selectVideoCaptureModeForIndex = useCallback(
    (targetIndex: number) => {
      const targetCut = cuts[targetIndex];
      if (!targetCut || targetCut.isFixed || uploadingCuts[targetIndex]) {
        return;
      }

      setActiveCutIndex(targetIndex);
      setIsMediaSourceOpen(false);
      clearGalleryError();
      clearTrimError();
    },
    [cuts, uploadingCuts, clearGalleryError, clearTrimError]
  );

  const openCutMediaSource = useCallback(
    (targetIndex: number) => {
      const targetCut = cuts[targetIndex];
      if (!targetCut || targetCut.isFixed || uploadingCuts[targetIndex] || isMediaImportBlocked) {
        return;
      }

      setActiveCutIndex(targetIndex);
      setMediaPickerTargetCutIndex(targetIndex);
      clearGalleryError();
      clearTrimError();
      setIsMediaSourceOpen(true);
    },
    [cuts, isMediaImportBlocked, uploadingCuts, clearGalleryError, clearTrimError]
  );

  const closeCutMediaSource = useCallback(() => {
    setIsMediaSourceOpen(false);
    setMediaPickerTargetCutIndex(null);
  }, []);

  const handleResetCut = () => {
    if (activeCut?.isFixed) {
      if (fixedClipErrors[activeCutIndex]) retryFixedClip(activeCutIndex);
    } else {
      resetCut(activeCutIndex);
      clearGalleryError();
      resetCamera();
    }
    setIsResetOpen(false);
  };

  useEffect(() => {
    if (stage !== 'capture') {
      stopRecording();
      setEditingCaptionId(null);
      resetCaptionGesture();
      setIsMediaSourceOpen(false);
      setIsTemplateGuideOpen(false);
      setIsCaptionEditDecisionOpen(false);
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

  const handleComplete = useCallback(() => {
    if (!allDone) return;
    setIsCaptionEditDecisionOpen(true);
  }, [allDone]);

  const handleEditCaptionsBeforeComplete = useCallback(() => {
    setIsCaptionEditDecisionOpen(false);
    setStage('caption-edit');
  }, []);

  const handleFinalComplete = async (options?: FinalCompleteOptions) => {
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
      .map((caption) => ({
        ...caption,
        text: normalizeCaptionText(caption.text),
      }))
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
      const completionAcceptedStaleClipIds =
        options?.acceptedStaleAutoCaptionClipIds ??
        acceptedStaleAutoCaptionClipIds;
      const response = await fetch(`/api/reels-maker/sessions/${sessionId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          captionItems,
          captionsEnabled,
          acceptedStaleAutoCaptionClipIds: completionAcceptedStaleClipIds,
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

  const handleSkipCaptionEditBeforeComplete = () => {
    if (!allDone) return;
    const nextAcceptedStaleClipIds = Array.from(
      new Set([
        ...acceptedStaleAutoCaptionClipIds,
        ...currentStaleAutoCaptionClipIds,
      ])
    );
    setIsCaptionEditDecisionOpen(false);
    setAcceptedStaleAutoCaptionClipIds(nextAcceptedStaleClipIds);
    void handleFinalComplete({
      acceptedStaleAutoCaptionClipIds: nextAcceptedStaleClipIds,
    });
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
    clearGalleryError();
    clearTrimError();
  }, [activeCutIndex, resetCaptionGesture, setEditingCaptionId, clearGalleryError, clearTrimError]);

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
    resetCamera();
    setSessionId(null);
    setSessionClipMap({});
    setSessionError(null);
    resetClips(cuts, true);
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
    setIsMediaSourceOpen(false);
    setMediaPickerTargetCutIndex(null);
    setReplacementConfirm(null);
    resetGallery();
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
                      ? buildTemplateLoginHref(
                          isReelstampBetaEnabled() ? currentReelsMakerHref : undefined
                        )
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
        staleClipIds={currentStaleAutoCaptionClipIds}
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
                      가이드
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
                      <div className="flex items-start gap-2">
                        {shouldShowGuideImageToggle && (
                          <button
                            type="button"
                            onClick={handleGuideImageToggle}
                            className="h-10 min-w-0 rounded-full border border-white/35 bg-white/15 px-3 text-[11px] leading-none font-semibold text-white whitespace-nowrap"
                          >
                            가이드 이미지 {isGuideImageVisible ? 'ON' : 'OFF'}
                          </button>
                        )}
                        <CaptureCaptionMenu
                          activeCutIndex={activeCutIndex}
                          overlayCaptionCount={activeOverlayCaptionCount}
                          maxCaptions={MAX_CAPTIONS_PER_CLIP}
                          isBoxed={activeCaptionStyle.boxed}
                          isAddDisabled={
                            !showCaptionStage ||
                            activeClipId == null ||
                            activeOverlayCaptionCount >= MAX_CAPTIONS_PER_CLIP
                          }
                          isToggleBoxDisabled={!showCaptionOverlay}
                          isDeleteDisabled={!resolvedSelectedCaptionId}
                          captionScale={activeCaptionStyle.scale}
                          isSizeDisabled={!showCaptionOverlay}
                          onAddCaption={addCaptionToActiveClip}
                          onToggleBox={handleCaptionToggleBox}
                          onDeleteCaption={deleteSelectedCaption}
                          onCaptionScaleChange={handleCaptionScaleChange}
                        />
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
                      <CaptureFlowAction
                        variant={captureFlowAction}
                        disabled={isCaptureFlowActionDisabled}
                        onComplete={handleComplete}
                      />

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
                        <CaptureActionControls
                          recordingStatus={recordingStatus}
                          galleryPreviewUrl={clipPosters[activeCutIndex] ?? null}
                          canRetake={canRetakeActiveCut}
                          isGalleryDisabled={isGalleryButtonDisabled}
                          isRecordDisabled={isRecordDisabled}
                          isSwitchCameraDisabled={isSwitchCameraDisabled}
                          onOpenGallery={() => void openGalleryPickerForIndex(activeCutIndex)}
                          onStartRecording={() => void startRecording()}
                          onStopRecording={stopRecording}
                          onRequestRetake={() => setIsResetOpen(true)}
                          onSwitchCamera={handleSwitchCamera}
                        />
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
                              ? `${formatDurationSecondsLabel(forcedRemainingSeconds)} 남음`
                              : `${formatDurationSeconds(elapsedSeconds)}초 경과`}
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

      {isCaptionEditDecisionOpen && (
        <CaptionEditDecisionModal
          onSkip={handleSkipCaptionEditBeforeComplete}
          onEdit={handleEditCaptionsBeforeComplete}
          onCancel={() => setIsCaptionEditDecisionOpen(false)}
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
