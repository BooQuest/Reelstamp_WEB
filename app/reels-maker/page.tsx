'use client';

import { SessionInitialization, type SessionInitializationMode } from './services/sessionInitialization';
import PreparationView from './components/PreparationView';
import { makerFetch as authFetch, loadEditorSession, releaseEditorSession } from '@/app/reels-maker/services/editSession';
import GalleryMaker, { type GalleryMakerHandle } from './gallery/GalleryMaker';
import useGalleryWorkspace from './gallery/useGalleryWorkspace';

import { useAuth } from '@/app/components/providers/AuthProvider';
import type { WebApiResponse } from '@/app/lib/api/auth';
import { USER_ROLES } from '@/app/lib/constants/auth';
import { isReelstampBetaEnabled } from '@/app/lib/constants/beta';
import {
  buildTemplateLoginHref,
  isComingSoonTemplate,
  PAID_TEMPLATE_REQUIRED_ERROR_CODE,
  TEMPLATE_LOGIN_REQUIRED_ERROR_CODE,
  TEMPLATE_LOGIN_REQUIRED_MESSAGE,
  TEMPLATE_NOT_AVAILABLE_MESSAGE,
  TEMPLATE_PAYMENT_PATH,
} from '@/app/lib/templates/access';
import AutoCaptionEditor from '@/app/reels-maker/components/AutoCaptionEditor';
import CaptionEditDecisionModal from '@/app/reels-maker/components/CaptionEditDecisionModal';
import CaptureMenu from '@/app/reels-maker/components/CaptureMenu';
import useProjectExit from '@/app/reels-maker/hooks/useProjectExit';
import ExitConfirmModal from '@/app/reels-maker/components/ExitConfirmModal';
import FinalPreview from '@/app/reels-maker/components/FinalPreview';
import FullScreenState from '@/app/reels-maker/components/FullScreenState';
import GuestDraftNotice from '@/app/reels-maker/components/GuestDraftNotice';
import ProcessingView from '@/app/reels-maker/components/ProcessingView';
import TemplateGuideModal, {
  type TemplateGuideStep,
} from '@/app/reels-maker/components/TemplateGuideModal';
import {
  COMPLETE_START_FAILED_USER_MESSAGE,
  DURATION_MODE_FORCED,
  DURATION_MODE_RECOMMENDED,
  PROCESSING_FAILED_USER_MESSAGE,
  PROCESSING_STATUS_TIMEOUT_MS,
} from '@/app/reels-maker/constants';
import useAutoCaption from '@/app/reels-maker/hooks/useAutoCaption';
import useCaptionEditor from '@/app/reels-maker/hooks/useCaptionEditor';
import useDraftAutosave from '@/app/reels-maker/hooks/useDraftAutosave';
import type {
  CaptionItem,
  ReelsMakerErrorResponse,
  ReelsMakerSessionResponse,
  ReelsMakerStatusResponse,
  Stage,
  TemplateDetailResponse,
  TemplateExampleReel,
} from '@/app/reels-maker/types';
import {
  buildCaptionExportStyle,
  normalizeSessionCaptions,
  normalizeCaptionText,
} from '@/app/reels-maker/utils/captions';
import { getErrorMessage } from '@/app/reels-maker/utils/errors';
import { ChevronLeft, Menu } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import useClipLibrary from './hooks/useClipLibrary';
import { revokeBlobUrl } from './utils/media/previews';

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
  errorCode?: string | null,
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

function ReelsMakerInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, user } = useAuth();
  const templateId = searchParams.get('templateId');
  const requestedSessionId = searchParams.get('sessionId');
  const returnUrlParam = searchParams.get('returnUrl');
  const completionReturnUrl = useMemo(
    () => normalizeCompletionReturnUrl(returnUrlParam),
    [returnUrlParam],
  );
  const explicitCompletionReturnUrl = returnUrlParam
    ? completionReturnUrl
    : null;
  const cameraFrameRef = useRef<HTMLDivElement | null>(null);

  const sessionHydratedRef = useRef(false);
  const sessionInitialization = useRef(new SessionInitialization());
  const sessionRoute = useRef({ templateId, requestedSessionId });
  sessionRoute.current = { templateId, requestedSessionId };
  const sessionMounted = useRef(true);
  useEffect(() => {
    sessionMounted.current = true;
    return () => { sessionMounted.current = false; };
  }, []);
  useEffect(() => {
    sessionInitialization.current.observe(templateId, requestedSessionId);
  }, [templateId, requestedSessionId]);

  const [stage, setStage] = useState<Stage>('capture');

  const [template, setTemplate] = useState<TemplateDetailResponse | null>(null);
  const [isTemplateLoading, setIsTemplateLoading] = useState(true);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [gallerySession, setGallerySession] =
    useState<ReelsMakerSessionResponse | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [preparationError, setPreparationError] = useState<string | null>(null);
  const completing = useRef(false);
  const completionStartedAt = useRef<number | null>(null);
  const completionPreparationState = useRef('saved');
  const galleryMakerRef = useRef<GalleryMakerHandle>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessionClipMap, setSessionClipMap] = useState<Record<number, number>>(
    {},
  );
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<SessionErrorState | null>(
    null,
  );
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false);
  const [pendingExitHref, setPendingExitHref] = useState('/my-projects');
  const [processingDelayed, setProcessingDelayed] = useState(false);
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
  const [isTemplateGuideOpen, setIsTemplateGuideOpen] = useState(false);
  const [templateGuideStep, setTemplateGuideStep] =
    useState<TemplateGuideStep>('overview');
  const [exampleReelIndex, setExampleReelIndex] = useState(0);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [finalVideoMimeType, setFinalVideoMimeType] =
    useState<string>('video/mp4');
  const [finalPosterUrl, setFinalPosterUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [downloadToastMessage, setDownloadToastMessage] = useState<
    string | null
  >(null);
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
    [],
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
        label: `${Number(duration.toFixed(1))}s`,
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
    serializeEdit,
    projectName,
    setProjectName,
    draftSaveStatus,
    lastSavedAt,
    captionsRef,
    saveDraftNow,
    getDraftVersion,
    hydrateDraft,
    resetDraft,
    applyServerUpdate,
    cancelScheduledSave,
    resumeAutosave,
    suspendAutosave,
    waitForSaves,
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
    clips,
    clipPosters,
    clipUploadErrors,
    fixedClipErrors,
    replaceClips,
    hydrate: hydrateClips,
    reset: resetClips,
    retryFixedClip,
  } = useClipLibrary({ cuts, sessionId, sessionClipMap });
  const activeCut = cuts[activeCutIndex] ?? null;
  const allDone = useMemo(() => {
    if (cuts.length === 0) return false;
    if (!sessionId) return false;
    return cuts.every((cut, index) => {
      if (cut.isFixed) {
        return Boolean(clips[index]) && !fixedClipErrors[index];
      }
      return Boolean(clips[index]);
    });
  }, [clips, cuts, fixedClipErrors, sessionId]);
  const isActiveCutFixed = activeCut?.isFixed ?? false;
  const activeFixedError = fixedClipErrors[activeCutIndex];
  const activeUploadError = clipUploadErrors[activeCutIndex];
  const activeClip = clips[activeCutIndex] ?? null;
  const activeClipId = activeCut
    ? (sessionClipMap[activeCut.order] ?? null)
    : null;

  const showCaptionStage =
    captionsEnabled &&
    !activeUploadError &&
    !activeFixedError &&
    (!isActiveCutFixed || Boolean(activeClip));
  const captionEditor = useCaptionEditor({
    activeClipId,
    showCaptionStage,
    stage,
    captions,
    setCaptions,
    captionsRef,
    cameraFrameRef,
  });
  const {
    captionStageRef,
    captionOverlayRef,
    captionInputRef,
    captionPreviewScale,
    setSelectedCaptionId,
    editingCaptionId,
    setEditingCaptionId,
    resolvedSelectedCaptionId,
    resetCaptionGesture,
    handleCameraFrameRef,
    deleteSelectedCaption,
    handleCaptionPointerMove,
    handleCaptionPointerEnd,
    handleCaptionPointerDown,
    handleResizeHandlePointerMove,
    handleResizeHandlePointerEnd,
    handleResizeHandlePointerDown,
    handleCaptionTextChange,
    handleCaptionToggleBox,
  } = captionEditor;
  const applyCaptionSessionSnapshot = useCallback(
    (session: ReelsMakerSessionResponse) => {
      setGallerySession(session);
      const nextCaptions = normalizeSessionCaptions(session.captionItems);
      // STT refreshes generated captions; retain concurrent local overlay/text edits.
      setCaptions(current => [...current.filter(item => item.source !== 'AUTO'), ...nextCaptions.filter(item => item.source === 'AUTO')]);
      setAutoCaptionAvailable(Boolean(session.autoCaptionAvailable));
      setAutoCaptionRemainingAttempts(
        session.autoCaptionRemainingAttempts ?? 0,
      );
      setActiveAutoCaptionJobId(session.activeAutoCaptionJobId ?? null);
      setLatestAutoCaptionJobId(session.latestAutoCaptionJobId ?? null);
      setStaleAutoCaptionClipIds(session.staleAutoCaptionClipIds ?? []);
      setAcceptedStaleAutoCaptionClipIds((current) =>
        current.filter((clipId) =>
          (session.staleAutoCaptionClipIds ?? []).includes(clipId),
        ),
      );
      applyServerUpdate(session);
    },
    [applyServerUpdate],
  );
  const applyGallerySession = useCallback(
    async (session: ReelsMakerSessionResponse) => {
      setGallerySession(session);
      setStaleAutoCaptionClipIds(session.staleAutoCaptionClipIds ?? []);
      applyServerUpdate(session);
    },
    [applyServerUpdate],
  );

  const galleryWorkspace = useGalleryWorkspace({
    session: gallerySession, cuts, clips, captions, captionsEnabled, activeCutIndex,
    onSession: applyGallerySession, serialize: task => serializeEdit(task, true),
    onLocalClips: replaceClips,
    onLocalCaptions: (items, enabled) => { setCaptions(items); setCaptionsEnabled(enabled); },
  });
  const editorBusy = galleryWorkspace.busy || Boolean(galleryWorkspace.editing);

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
    [...new Set([...(autoCaptionJob?.staleClipIds ?? []), ...staleAutoCaptionClipIds])];
  const exampleReels: TemplateExampleReel[] =
    template?.exampleReels && template.exampleReels.length > 0
      ? template.exampleReels
      : (template?.exampleReelUrls ?? []).map((url) => ({
          url,
          instagramOnly: false,
        }));
  const exampleReelUrls = exampleReels.map((reel) => reel.url);
  const handleTemplateGuidePrimaryAction = () => {
    if (typeof templateGuideStep !== 'number') return;
    const index = templateGuideStep;
    setActiveCutIndex(index);
    if (!cuts[index]?.isFixed) galleryMakerRef.current?.openPicker(index);
    setIsTemplateGuideOpen(false);
  };

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
        const response = await authFetch(
          `/api/templates/${encodeURIComponent(templateId)}`,
          {
            method: 'GET',
            cache: 'no-store',
          },
        );

        const payload: WebApiResponse<TemplateDetailResponse> =
          await response.json();

        if (!response.ok || !payload?.success) {
          throw new Error(
            payload?.message || '템플릿 정보를 불러오지 못했습니다.',
          );
        }

        const data = payload.data;
        if (!data) {
          throw new Error(
            payload?.message || '템플릿 정보를 불러오지 못했습니다.',
          );
        }
        if (isComingSoonTemplate(data)) {
          throw new Error(TEMPLATE_NOT_AVAILABLE_MESSAGE);
        }
        const normalizedExampleReels: TemplateExampleReel[] = Array.isArray(
          data?.exampleReels,
        )
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
          setTemplateError(
            getErrorMessage(error, '템플릿 정보를 불러오지 못했습니다.'),
          );
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

  const createReelsSession = useCallback(async (mode: SessionInitializationMode = 'automatic') => {
    if (!templateId || !template || template.id !== templateId) return;
    const currentRoute = sessionRoute.current;
    if (!sessionMounted.current || currentRoute.templateId !== templateId
        || currentRoute.requestedSessionId !== requestedSessionId) return;
    const initialization = sessionInitialization.current;
    initialization.observe(templateId, requestedSessionId);
    const attempt = initialization.begin(mode);
    if (!attempt) return;
    const isCurrent = () => {
      const route = sessionRoute.current;
      initialization.observe(route.templateId, route.requestedSessionId);
      return sessionMounted.current && initialization.isCurrent(attempt);
    };
    const restoreExisting = attempt.sessionId !== null;

    const fallbackMessage = getSessionFallbackMessage(requestedSessionId);
    setIsSessionLoading(true);
    setSessionError(null);
    sessionHydratedRef.current = false;
    try {
      const response = await loadEditorSession(templateId, attempt.sessionId);

      const payload = (await response.json()) as
        | WebApiResponse<ReelsMakerSessionResponse>
        | ReelsMakerErrorResponse;
      if (!isCurrent()) return;
      if (!response.ok || !payload?.success || !payload?.data) {
        const status =
          typeof payload?.status === 'number'
            ? payload.status
            : response.status;
        const errorCode =
          typeof payload?.errorCode === 'string' ? payload.errorCode : null;
        const nextSessionError = buildSessionErrorState({
          status,
          errorCode,
          message: payload?.message,
          fallbackMessage,
        });

        initialization.finish(attempt, 'failed');
        if (nextSessionError.type === 'auth' && sessionId) return;
        setSessionError(nextSessionError);
        setSessionId(null);
        setGallerySession(null);
        setSessionClipMap({});
        return;
      }

      const session = payload.data as ReelsMakerSessionResponse;
      if (session.templateId !== templateId) {
        throw new Error('선택한 템플릿과 저장된 프로젝트가 일치하지 않습니다.');
      }
      initialization.resolved(attempt, session.sessionId);
      const mapping: Record<number, number> = {};
      (session.clips ?? []).forEach((clip) => {
        if (clip?.order != null && clip?.clipId != null) {
          mapping[clip.order] = clip.clipId;
        }
      });
      setSessionId(session.sessionId);
      setSessionClipMap(mapping);
      setGallerySession(session);
      const restoredCaptions = normalizeSessionCaptions(session.captionItems);
      setCaptions(restoredCaptions);
      setCaptionsEnabled(session.captionsEnabled !== false);
      setAutoCaptionAvailable(Boolean(session.autoCaptionAvailable));
      setAutoCaptionRemainingAttempts(
        session.autoCaptionRemainingAttempts ?? 0,
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
      } else if (session.status === 'COMPLETED' && session.displayStatus !== 'CAPTURE') {
        setFinalVideoUrl(session.finalVideoUrl || null);
        setFinalVideoMimeType('video/mp4');
        setStage('preview');
      } else if (session.status === 'FAILED' || (session.status === 'COMPLETED' && session.displayStatus === 'CAPTURE')) {
        setStage('capture');
      } else if (session.activeAutoCaptionJobId) {
        setStage('caption-edit');
      }

      if (!requestedSessionId && session.status === 'CAPTURE') {
        setTemplateGuideStep('overview');
        setIsTemplateGuideOpen(true);
      }

      const restored = await hydrateClips(session, restoreExisting);
      if (!isCurrent()) return;
      if (!restored) throw new Error('프로젝트를 불러오지 못했습니다. 다시 시도해 주세요.');
      const restoredIndex = cuts.findIndex(
        (cut) => cut.order === session.lastActiveClipOrder,
      );
      const resolvedActiveIndex = restoredIndex >= 0 ? restoredIndex : 0;
      if (restoreExisting) {
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
      initialization.finish(attempt, 'ready');
      if (!sessionRoute.current.requestedSessionId) {
        router.replace(
          buildReelsMakerHref({
            templateId,
            sessionId: session.sessionId,
            returnUrl: explicitCompletionReturnUrl,
          }),
        );
      }
    } catch (error: unknown) {
      if (!isCurrent()) return;
      initialization.finish(attempt, 'failed');
      setSessionError({
        type: 'generic',
        message: getErrorMessage(error, fallbackMessage),
      });
      setSessionId(null);
      setGallerySession(null);
      setSessionClipMap({});
    } finally {
      if (isCurrent()) setIsSessionLoading(false);
    }
  }, [
    cuts,
    explicitCompletionReturnUrl,
    hydrateDraft,
    hydrateClips,
    sessionId,
    requestedSessionId,
    router,
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
    setSessionId(null);
    setGallerySession(null);
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
    setEditingCaptionId(null);
    resetCaptionGesture();
    setFinalVideoUrl((prev) => {
      revokeBlobUrl(prev);
      return null;
    });
    setFinalPosterUrl(null);
    setFinalVideoMimeType('video/mp4');
    setIsPreviewOpen(false);
    setIsTemplateGuideOpen(false);
    setTemplateGuideStep('overview');
  }, [
    template?.id,
    cuts,
    resetCaptionGesture,
    resetDraft,
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
    if (
      typeof templateGuideStep === 'number' &&
      templateGuideStep >= cuts.length
    ) {
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

  // 출시 후 음성인식 자막 편집 안내를 다시 연결할 때 복원합니다.
  // const handleComplete = useCallback(() => {
  //   if (!allDone) return;
  //   setIsCaptionEditDecisionOpen(true);
  // }, [allDone]);

  const handleEditCaptionsBeforeComplete = useCallback(() => {
    setIsCaptionEditDecisionOpen(false);
    setStage('caption-edit');
  }, []);

  const handleFinalComplete = async (options?: FinalCompleteOptions) => {
    if (!sessionId || !allDone || completing.current) return;
    completing.current = true;
    completionStartedAt.current = performance.now();
    completionPreparationState.current = galleryWorkspace.saveState;
    setPreparing(true); setPreparationError(null);
    let savedVersion: number | undefined;
    try {
      const savedSession = await galleryWorkspace.flush();
      if (!(await saveDraftNow())) throw new Error('최신 작업 내용을 저장하지 못했습니다.');
      savedVersion = getDraftVersion() ?? savedSession?.draftVersion ?? undefined;
    } catch (error) {
      setPreparationError(error instanceof Error ? error.message : '제작 준비에 실패했습니다.');
      completing.current = false;
      return;
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

    setPreparing(false);
    setFinalVideoUrl(null);
    setFinalVideoMimeType('video/mp4');
    setFinalPosterUrl(null);
    setStage('processing');

    try {
      const completionAcceptedStaleClipIds =
        options?.acceptedStaleAutoCaptionClipIds ??
        acceptedStaleAutoCaptionClipIds;
      const response = await authFetch(
        `/api/reels-maker/sessions/${sessionId}/complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            captionItems,
            version: savedVersion,
            captionsEnabled,
            acceptedStaleAutoCaptionClipIds: completionAcceptedStaleClipIds,
          }),
        },
      );
      const payload = (await response.json()) as
        | WebApiResponse<ReelsMakerStatusResponse>
        | ReelsMakerErrorResponse;
      if (!response.ok || !payload?.success) {
        const statusCode =
          typeof payload?.status === 'number'
            ? payload.status
            : response.status;
        const errorCode =
          payload &&
          'errorCode' in payload &&
          typeof payload.errorCode === 'string'
            ? payload.errorCode
            : 'UNKNOWN';
        const backendMessage =
          typeof payload?.message === 'string' &&
          payload.message.trim().length > 0
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
      releaseEditorSession(sessionId);
    } catch (error) {
      console.error('[ReelsMakerCompleteRequestError]', {
        sessionId,
        error,
      });
      try {
        const check = await authFetch(`/api/reels-maker/sessions/${sessionId}/status`, { cache: 'no-store' });
        const result = await check.json();
        if (result.data?.status === 'PROCESSING' || result.data?.status === 'COMPLETED') return;
      } catch { /* The server also returns the current job for duplicate completion requests. */ }
      completing.current = false;
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
      ]),
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
    let finished = false;
    let delayReported = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const startedAt = Date.now();
    setProcessingDelayed(false);

    const fetchStatus = async () => {
      try {
        const response = await authFetch(
          `/api/reels-maker/sessions/${sessionId}/status`,
          {
            method: 'GET',
            cache: 'no-store',
            signal: controller.signal,
          },
        );
        const payload: WebApiResponse<ReelsMakerStatusResponse> =
          await response.json();
        if (!response.ok || !payload?.success || !payload?.data) {
          return;
        }
        const data = payload.data;
        if (isCancelled) return;
        if (data.status === 'COMPLETED' && data.finalVideoUrl) {
          finished = true;
          setFinalVideoUrl(data.finalVideoUrl || null);
          setFinalVideoMimeType('video/mp4');
          completing.current = false;
          setStage('preview');
        } else if (data.status === 'FAILED') {
          finished = true;
          console.error('[ReelsMakerProcessingFailed]', {
            sessionId,
            processingJobId: data.processingJobId ?? null,
            errorMessage: data.errorMessage ?? null,
          });
          completing.current = false;
          releaseEditorSession(sessionId);
          setStage('capture');
          void createReelsSession('reload');
          alert(PROCESSING_FAILED_USER_MESSAGE);
        } else if (!delayReported && Date.now() - startedAt > PROCESSING_STATUS_TIMEOUT_MS) {
          delayReported = true;
          console.error('[ReelsMakerProcessingTimeout]', {
            sessionId,
            elapsedMs: Date.now() - startedAt,
            lastKnownStatus: data.status,
            processingJobId: data.processingJobId ?? null,
          });
          setProcessingDelayed(true);
        }
      } catch {
        // Retry transient polling errors without overlapping requests.
      } finally {
        if (!isCancelled && !delayReported && Date.now() - startedAt > PROCESSING_STATUS_TIMEOUT_MS) {
          delayReported = true;
          setProcessingDelayed(true);
        }
        if (!isCancelled && !finished) {
          timer = setTimeout(fetchStatus, gallerySession ? 1000 : 2000);
        }
      }
    };

    fetchStatus();

    return () => {
      isCancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [sessionId, stage, gallerySession, createReelsSession]);

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
      if (editorBusy) {
        alert('편집 저장이 완료된 뒤 나가주세요.');
        return;
      }

      resumeAutosave();
      setPendingExitHref(href);
      setIsExitConfirmOpen(true);
    },
    [editorBusy, resumeAutosave],
  );

  const { isSaving: isExitSaving, save: handleSaveAndExit,
    discard: handleExitWithoutSaving, continueEditing } = useProjectExit({
    sessionId, isGuestUser, destination: pendingExitHref,
    navigate: router.push, close: () => setIsExitConfirmOpen(false), workspace: galleryWorkspace,
    cancelScheduledSave, saveDraftNow, getDraftVersion, suspendAutosave, resumeAutosave, waitForSaves,
  });

  useEffect(() => {
    setEditingCaptionId(null);
    resetCaptionGesture();
  }, [activeCutIndex, resetCaptionGesture, setEditingCaptionId]);

  useEffect(() => {
    if (stage === 'capture') return;
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
  }, [deleteSelectedCaption, resolvedSelectedCaptionId, stage]);

  const handleDownload = () => {
    if (!finalVideoUrl) return;
    const anchor = document.createElement('a');
    const downloadUrl = `/api/reels-maker/download?sessionId=${sessionId}`;
    anchor.href = downloadUrl;
    const isMp4 = finalVideoMimeType.includes('mp4');
    anchor.download = `reelstamp-reel.${isMp4 ? 'mp4' : 'webm'}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setDownloadToastMessage(
      isMp4
        ? '다운로드 완료!'
        : 'MP4 미지원 브라우저로 WEBM으로 다운로드됩니다.',
    );
  };

  const handleFinalDone = () => {
    setIsPreviewOpen(false);
    router.replace(completionReturnUrl);
  };

  const handleResetAll = () => {
    setStage('capture');
    setActiveCutIndex(0);
    setSessionId(null);
    setGallerySession(null);
    setSessionClipMap({});
    setSessionError(null);
    resetClips(cuts, true);
    setCaptions([]);
    setSelectedCaptionId(null);
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
    setDownloadToastMessage(null);
    if (templateId && requestedSessionId) {
      router.replace(
        buildReelsMakerHref({
          templateId,
          returnUrl: explicitCompletionReturnUrl,
        }),
      );
    } else {
      sessionInitialization.current.reset();
      void createReelsSession();
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
          <p className="text-sm leading-6 text-white/70">
            {sessionError.message}
          </p>
          <div className="space-y-3">
            {sessionError.type === 'auth' ||
            sessionError.type === 'template-login' ? (
              <button
                type="button"
                onClick={() =>
                  router.push(
                    sessionError.type === 'template-login'
                      ? buildTemplateLoginHref(
                          isReelstampBetaEnabled()
                            ? currentReelsMakerHref
                            : undefined,
                        )
                      : buildLoginHref(currentReelsMakerHref),
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
                onClick={() => createReelsSession('retry')}
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

  if (preparing) {
    return <PreparationView state={galleryWorkspace.saveState} error={preparationError}
      onRetry={() => void handleFinalComplete()}
      onBack={() => setPreparing(false)} />;
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
        onStartAutoCaption={async () => { await galleryWorkspace.flush(); return startAutoCaption(); }}
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
    return <ProcessingView delayed={processingDelayed} onExit={() => router.push('/my-projects?status=PROCESSING')} />;
  }

  if (stage === 'preview') {
    return (
      <FinalPreview
        sessionId={sessionId}
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
        onReady={() => {
          if (completionStartedAt.current !== null) {
            console.info('[ReelsMakerTiming]', { phase: 'complete-to-first-frame', preparationStateAtClick: completionPreparationState.current, elapsedMs: Math.round(performance.now() - completionStartedAt.current) });
            completionStartedAt.current = null;
          }
        }}
        onShared={setDownloadToastMessage}
      />
    );
  }

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#1E2A3B] text-white">
      {gallerySession && (
        <GalleryMaker
          key={gallerySession.sessionId}
          workspace={galleryWorkspace}
          session={gallerySession}
          cuts={cuts}
          clips={clips}
          captionsEnabled={captionsEnabled}
          activeCutIndex={activeCutIndex}
          onSelectCut={setActiveCutIndex}
          allDone={allDone}
          captionEditor={captionEditor}
          fixedErrors={fixedClipErrors}
          onRetryFixed={retryFixedClip}
          ref={galleryMakerRef}
          paused={isTemplateGuideOpen || isExitConfirmOpen || isCaptureMenuOpen}
          onGuide={() => {
            setTemplateGuideStep(activeCutIndex);
            setIsTemplateGuideOpen(true);
          }}
          // onNext={handleComplete}
          onNext={handleSkipCaptionEditBeforeComplete}
          header={
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="뒤로가기"
                disabled={editorBusy}
                onClick={() => requestExit('/templates')}
                className="p-1"
              >
                <ChevronLeft />
              </button>
              <div className="min-w-0 flex-1">
                {isRegisteredUser ? (
                  <input
                    aria-label="프로젝트 이름"
                    value={projectName}
                    onChange={(e) =>
                      setProjectName(e.target.value.slice(0, 50))
                    }
                    onBlur={() => {
                      if (!projectName.trim())
                        setProjectName(`${template.title || '릴스'} 프로젝트`);
                    }}
                    className="w-full bg-transparent text-sm font-semibold outline-none"
                  />
                ) : (
                  <span className="text-sm">릴스 제작</span>
                )}
                {isRegisteredUser ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (draftSaveStatus === 'error') void saveDraftNow();
                    }}
                    className="block text-[10px] text-white/60"
                  >
                    {galleryWorkspace.saveState === 'uploading'
                      ? '원본 업로드 중'
                      : galleryWorkspace.saveState === 'saving'
                        ? '편집 저장 중'
                        : galleryWorkspace.saveState === 'error' || galleryWorkspace.saveState === 'conflict'
                          ? '편집 저장 실패'
                          : draftSaveStatus === 'saving'
                      ? '저장 중…'
                      : draftSaveStatus === 'error'
                        ? '저장 실패 · 다시 시도'
                        : lastSavedAt
                          ? '자동 저장됨'
                          : '자동 저장 준비 중'}
                  </button>
                ) : (
                  <p className="text-[10px] text-amber-200">
                    게스트 작업은 중간 저장되지 않습니다.
                  </p>
                )}
              </div>
              <button
                type="button"
                aria-label="메뉴"
                disabled={editorBusy}
                onClick={() => setIsCaptureMenuOpen(true)}
                className="p-1"
              >
                <Menu size={20} />
              </button>
            </div>
          }
        />
      )}
      {showGuestDraftNotice && isGuestUser && (
        <GuestDraftNotice
          loginHref={buildLoginHref(currentReelsMakerHref)}
          onContinue={() => setShowGuestDraftNotice(false)}
        />
      )}
      {isExitConfirmOpen && (
        <ExitConfirmModal
          isGuestUser={isGuestUser}
          isNewProject={gallerySession?.newEdit ?? false}
          isSaving={isExitSaving}
          onSaveAndExit={() => void handleSaveAndExit()}
          onExitWithoutSaving={() => void handleExitWithoutSaving()}
          onContinue={continueEditing}
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
      {isTemplateGuideOpen && (
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
