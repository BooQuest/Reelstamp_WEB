'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent as ReactChangeEvent,
  type ComponentType,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  Bookmark,
  Camera,
  ChevronLeft,
  ChevronRight,
  Check,
  CheckCircle,
  Download,
  Image as ImageIcon,
  LayoutTemplate,
  Loader2,
  Menu,
  Music2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  SwitchCamera,
  TrendingUp,
  User,
  X,
} from 'lucide-react';
import type { WebApiResponse } from '@/app/lib/api/auth';
import InstagramEmbed from '@/app/components/ui/InstagramEmbed';
import { useAuth } from '@/app/components/providers/AuthProvider';
import { USER_ROLES } from '@/app/lib/constants/auth';
import InstagramShareButton from '@/app/reels-maker/InstagramShareButton';
import CapturedClipPreview from '@/app/reels-maker/components/CapturedClipPreview';

const EXAMPLE_ASSETS = {
  exampleImage:
    'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80',
} as const;

const VIDEO_ASSET_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v', '.ogg', '.ogv'] as const;
const TEMPLATE_ASSET_BASE_URL = process.env.NEXT_PUBLIC_OCI_TEMPLATE_BASE_URL ?? '';

type ExampleMedia = {
  type: 'image' | 'video';
  src: string;
};

type GuideImageEntry = {
  url: string;
  startSecond: number | null;
};

const isVideoAssetUrl = (url: string) => {
  const path = url.trim().split(/[?#]/)[0]?.toLowerCase() ?? '';
  return VIDEO_ASSET_EXTENSIONS.some((extension) => path.endsWith(extension));
};

const isAbsoluteAssetUrl = (url: string) =>
  /^(https?:|blob:|data:)/i.test(url) || url.startsWith('/');

const joinTemplateAssetUrl = (key: string) => {
  const trimmed = key.trim();
  if (!trimmed || isAbsoluteAssetUrl(trimmed) || !TEMPLATE_ASSET_BASE_URL) {
    return trimmed;
  }
  const base = TEMPLATE_ASSET_BASE_URL.endsWith('/')
    ? TEMPLATE_ASSET_BASE_URL.slice(0, -1)
    : TEMPLATE_ASSET_BASE_URL;
  const normalizedKey = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  return `${base}/${normalizedKey}`;
};

const extractGuideImageJson = (value: string) => {
  const trimmed = value.trim();
  const jsonStartIndex = trimmed.indexOf('[');
  if (jsonStartIndex === 0) return trimmed;
  if (jsonStartIndex > 0) return trimmed.slice(jsonStartIndex).trim();

  const base = TEMPLATE_ASSET_BASE_URL.endsWith('/')
    ? TEMPLATE_ASSET_BASE_URL.slice(0, -1)
    : TEMPLATE_ASSET_BASE_URL;
  if (!trimmed.startsWith(`${base}/`)) return null;

  const rest = trimmed.slice(base.length + 1).trim();
  return rest.startsWith('[') ? rest : null;
};

const readGuideStartSecond = (entry: Record<string, unknown>) => {
  const rawValue = entry.startSecond ?? entry.start_second ?? entry.start;
  if (rawValue == null || rawValue === '') return null;
  const value = typeof rawValue === 'number' ? rawValue : Number(rawValue);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.floor(value);
};

const normalizeGuideImageEntry = (value: unknown, order: number) => {
  if (typeof value === 'string') {
    const url = value.trim();
    return url ? { url: joinTemplateAssetUrl(url), startSecond: null, order } : null;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const entry = value as Record<string, unknown>;
  const url = typeof entry.url === 'string' ? entry.url.trim() : '';
  if (!url) return null;
  return {
    url: joinTemplateAssetUrl(url),
    startSecond: readGuideStartSecond(entry),
    order,
  };
};

const parseGuideImageEntries = (rawValue?: string | null): GuideImageEntry[] => {
  const value = rawValue?.trim();
  if (!value) return [];

  const jsonValue = extractGuideImageJson(value);
  if (jsonValue) {
    try {
      const parsed = JSON.parse(jsonValue);
      if (Array.isArray(parsed)) {
        return parsed
          .map((entry, index) => normalizeGuideImageEntry(entry, index))
          .filter((entry): entry is GuideImageEntry & { order: number } => Boolean(entry))
          .sort((a, b) => {
            const aStart = a.startSecond ?? Number.POSITIVE_INFINITY;
            const bStart = b.startSecond ?? Number.POSITIVE_INFINITY;
            if (aStart !== bStart) return aStart - bStart;
            return a.order - b.order;
          })
          .map((entry) => ({
            url: entry.url,
            startSecond: entry.startSecond,
          }));
      }
    } catch {
      return [{ url: joinTemplateAssetUrl(value), startSecond: null }];
    }
  }

  return [{ url: joinTemplateAssetUrl(value), startSecond: null }];
};

type CaptureMenuItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  requiresAuth?: boolean;
};

const CAPTURE_MENU_ITEMS: CaptureMenuItem[] = [
  {
    href: '/templates',
    label: '맞춤형 릴스 추천',
    icon: Sparkles,
  },
  {
    href: '/all-templates',
    label: '릴스 템플릿',
    icon: LayoutTemplate,
  },
  {
    href: '/trending-reels',
    label: '오늘의 릴스 트렌드',
    icon: TrendingUp,
    requiresAuth: true,
  },
  {
    href: '/saved-reels',
    label: '저장된 릴스',
    icon: Bookmark,
    requiresAuth: true,
  },
  {
    href: '/completed-reels',
    label: '제작 완료된 릴스',
    icon: CheckCircle,
    requiresAuth: true,
  },
];

type ClipInfo = {
  blob: Blob;
  url: string;
  duration: number;
  mimeType: string;
};

type RecorderStatus = 'idle' | 'recording' | 'done';
type Stage = 'capture' | 'processing' | 'preview';
type CutDurationMode = 'RECOMMENDED' | 'FORCED';
type CameraFacingMode = 'environment' | 'user';

type TemplateCut = {
  order: number;
  durationSeconds: number;
  durationMode?: string | null;
  title?: string | null;
  guideText?: string | null;
  'guide_text'?: string | null;
  guideImageUrl?: string | null;
  'guide_image_url'?: string | null;
  exampleImageUrl?: string | null;
  exampleVideoUrl?: string | null;
  defaultCaption?: string | null;
  captureType?: string | null;
  fixedVideoUrl?: string | null;
  fixedPreviewImageUrl?: string | null;
};

type TemplateDetailResponse = {
  id: string;
  title: string;
  subtitle?: string | null;
  thumbnailUrl?: string | null;
  embedUrl?: string | null;
  exampleReelUrls?: string[];
  tags?: string[];
  cuts: TemplateCut[];
};

type ReelsMakerSessionClip = {
  clipId: number;
  order: number;
  durationSeconds: number;
  status?: string | null;
  objectKey?: string | null;
};

type ReelsMakerSessionResponse = {
  sessionId: number;
  templateId: string;
  status: string;
  finalVideoUrl?: string | null;
  processingJobId?: string | null;
  clips: ReelsMakerSessionClip[];
};

type ReelsMakerClipPresignResponse = {
  clipId: number;
  objectKey: string;
  uploadUrl: string;
  downloadUrl?: string | null;
  expiresAt?: string | null;
};

type ReelsMakerStatusResponse = {
  sessionId: number;
  status: string;
  finalVideoUrl?: string | null;
  processingJobId?: string | null;
  errorMessage?: string | null;
};
type ReelsMakerErrorResponse = {
  success?: boolean;
  status?: number;
  message?: string;
  errorCode?: string;
  data?: unknown;
};

type CaptionStyleVersion = 'WEB_BOX_V2';

type CaptionStyle = {
  xRatio: number;
  yRatio: number;
  scale: number;
  boxed: boolean;
  styleVersion?: CaptionStyleVersion;
  maxWidthRatio?: number;
  maxLines?: number | null;
  renderWidth?: number;
  renderHeight?: number;
  layoutWidth?: number;
  layoutHeight?: number;
  baseFontSizePx?: number;
  lineHeight?: number;
  fontFamily?: string;
  fontWeight?: number;
  textColor?: string;
  boxBackgroundColor?: string;
  boxBackgroundOpacity?: number;
  boxPaddingXPx?: number;
  boxPaddingYPx?: number;
  boxBorderRadiusPx?: number;
};

type CutCaptionState = {
  text: string;
  style: CaptionStyle;
};

type CaptionGestureMode = 'none' | 'drag' | 'pinch' | 'resize';

type CaptionGestureState = {
  mode: CaptionGestureMode;
  pointerMap: Map<number, { x: number; y: number }>;
  dragPointerId: number | null;
  startPointer: { x: number; y: number } | null;
  startStyle: CaptionStyle | null;
  startDistance: number;
  startScale: number;
};

type VideoMetadata = {
  duration: number;
  width: number;
  height: number;
};

type TrimDragMode = 'none' | 'start' | 'end' | 'window' | 'scrub';
type TrimDragStartState = {
  pointerX: number;
  startSeconds: number;
  endSeconds: number;
  scrubSeconds: number;
};

const MIN_CAPTION_SCALE = 0.6;
const MAX_CAPTION_SCALE = 2.2;
const MIN_CAPTION_MAX_WIDTH_RATIO = 0.5;
const MAX_CAPTION_MAX_WIDTH_RATIO = 0.95;
const MIN_TRIM_DURATION_SECONDS = 0.3;
const DEFAULT_GALLERY_CLIP_DURATION_SECONDS = 3;
const TIMELINE_THUMBNAIL_COUNT = 10;
const DURATION_MODE_RECOMMENDED: CutDurationMode = 'RECOMMENDED';
const DURATION_MODE_FORCED: CutDurationMode = 'FORCED';
const RECOMMENDED_AUTO_STOP_SECONDS = 60;
const CAPTION_STYLE_VERSION_WEB_BOX_V2: CaptionStyleVersion = 'WEB_BOX_V2';
const DEFAULT_CAPTION_MAX_WIDTH_RATIO = 0.85;
const CAPTION_RENDER_WIDTH = 1080;
const CAPTION_RENDER_HEIGHT = 1920;
const CAPTION_LAYOUT_FALLBACK_WIDTH = 408;
const CAPTION_BASE_FONT_SIZE_PX = 28;
const CAPTION_LINE_HEIGHT = 1.25;
const CAPTION_FONT_FAMILY = 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
const CAPTION_FONT_WEIGHT = 600;
const CAPTION_TEXT_COLOR = '#FFFFFF';
const CAPTION_BOX_BACKGROUND_COLOR = '#000000';
const CAPTION_BOX_BACKGROUND_OPACITY = 0.5;
const CAPTION_BOX_PADDING_X_PX = 16;
const CAPTION_BOX_PADDING_Y_PX = 8;
const CAPTION_BOX_BORDER_RADIUS_PX = 18;
const PROCESSING_STATUS_TIMEOUT_MS = 5 * 60 * 1000;
const COMPLETE_START_FAILED_ERROR_CODE = 'RS-VID-001';
const PROCESSING_FAILED_ERROR_CODE = 'RS-VID-002';
const PROCESSING_TIMEOUT_ERROR_CODE = 'RS-VID-003';
const COMPLETE_START_FAILED_USER_MESSAGE = `영상 생성을 시작하지 못했어요. 잠시 후 다시 시도해 주세요. 문제가 계속되면 고객센터로 문의해 주세요. (코드: ${COMPLETE_START_FAILED_ERROR_CODE})`;
const PROCESSING_FAILED_USER_MESSAGE = `영상 생성 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요. 문제가 계속되면 고객센터로 문의해 주세요. (코드: ${PROCESSING_FAILED_ERROR_CODE})`;
const PROCESSING_TIMEOUT_USER_MESSAGE = `영상 생성이 예상보다 오래 걸리고 있어요. 잠시 후 다시 확인해 주세요. 문제가 계속되면 고객센터로 문의해 주세요. (코드: ${PROCESSING_TIMEOUT_ERROR_CODE})`;
const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  xRatio: 0.5,
  yRatio: 0.12,
  scale: 1,
  boxed: true,
  styleVersion: CAPTION_STYLE_VERSION_WEB_BOX_V2,
  maxWidthRatio: DEFAULT_CAPTION_MAX_WIDTH_RATIO,
  maxLines: null,
};

const clampValue = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

const normalizeCaptionStyle = (style: CaptionStyle): CaptionStyle => ({
  xRatio: clampValue(style.xRatio, 0, 1),
  yRatio: clampValue(style.yRatio, 0, 1),
  scale: clampValue(style.scale, MIN_CAPTION_SCALE, MAX_CAPTION_SCALE),
  boxed: style.boxed !== false,
  styleVersion: CAPTION_STYLE_VERSION_WEB_BOX_V2,
  maxWidthRatio: clampValue(
    typeof style.maxWidthRatio === 'number' ? style.maxWidthRatio : DEFAULT_CAPTION_MAX_WIDTH_RATIO,
    MIN_CAPTION_MAX_WIDTH_RATIO,
    MAX_CAPTION_MAX_WIDTH_RATIO
  ),
  maxLines:
    typeof style.maxLines === 'number' && Number.isFinite(style.maxLines)
      ? Math.max(1, Math.round(style.maxLines))
      : null,
});

const resolveCaptionLayoutSize = (frameElement?: HTMLElement | null) => {
  const rawWidth = frameElement?.offsetWidth ?? CAPTION_LAYOUT_FALLBACK_WIDTH;
  const rawHeight =
    frameElement?.offsetHeight ?? Math.round((CAPTION_LAYOUT_FALLBACK_WIDTH * 16) / 9);
  const width =
    typeof rawWidth === 'number' && Number.isFinite(rawWidth) && rawWidth > 0
      ? rawWidth
      : CAPTION_LAYOUT_FALLBACK_WIDTH;
  const height =
    typeof rawHeight === 'number' && Number.isFinite(rawHeight) && rawHeight > 0
      ? rawHeight
      : Math.round((width * 16) / 9);
  return {
    layoutWidth: Math.round(width),
    layoutHeight: Math.round(height),
  };
};

const buildCaptionExportStyle = (
  style: CaptionStyle,
  frameElement?: HTMLElement | null
): CaptionStyle => {
  const normalized = normalizeCaptionStyle(style);
  const { layoutWidth, layoutHeight } = resolveCaptionLayoutSize(frameElement);

  return {
    ...normalized,
    renderWidth: CAPTION_RENDER_WIDTH,
    renderHeight: CAPTION_RENDER_HEIGHT,
    layoutWidth,
    layoutHeight,
    baseFontSizePx: CAPTION_BASE_FONT_SIZE_PX,
    lineHeight: CAPTION_LINE_HEIGHT,
    fontFamily: CAPTION_FONT_FAMILY,
    fontWeight: CAPTION_FONT_WEIGHT,
    textColor: CAPTION_TEXT_COLOR,
    boxBackgroundColor: CAPTION_BOX_BACKGROUND_COLOR,
    boxBackgroundOpacity: CAPTION_BOX_BACKGROUND_OPACITY,
    boxPaddingXPx: CAPTION_BOX_PADDING_X_PX,
    boxPaddingYPx: CAPTION_BOX_PADDING_Y_PX,
    boxBorderRadiusPx: CAPTION_BOX_BORDER_RADIUS_PX,
  };
};

function ReelsMakerInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, user } = useAuth();
  const templateId = searchParams.get('templateId');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraFrameRef = useRef<HTMLDivElement | null>(null);
  const captionOverlayRef = useRef<HTMLDivElement | null>(null);
  const captionInputRef = useRef<HTMLInputElement | null>(null);
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
  const recordingMimeTypeRef = useRef<string>('video/webm');
  const cameraSetupInProgressRef = useRef(false);
  const switchCameraInProgressRef = useRef(false);
  const latestClipsRef = useRef<Array<ClipInfo | null>>([]);
  const captionGestureRef = useRef<CaptionGestureState>({
    mode: 'none',
    pointerMap: new Map(),
    dragPointerId: null,
    startPointer: null,
    startStyle: null,
    startDistance: 0,
    startScale: 1,
  });

  const [stage, setStage] = useState<Stage>('capture');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [template, setTemplate] = useState<TemplateDetailResponse | null>(null);
  const [isTemplateLoading, setIsTemplateLoading] = useState(true);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessionClipMap, setSessionClipMap] = useState<Record<number, number>>({});
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [uploadedCuts, setUploadedCuts] = useState<Record<number, boolean>>({});
  const [uploadingCuts, setUploadingCuts] = useState<Record<number, boolean>>({});
  const [clipUploadErrors, setClipUploadErrors] = useState<Record<number, string>>({});
  const [activeCutIndex, setActiveCutIndex] = useState(0);
  const [recordingStatus, setRecordingStatus] = useState<RecorderStatus>('idle');
  const [recordingElapsedSeconds, setRecordingElapsedSeconds] = useState<number | null>(null);
  const [clips, setClips] = useState<Array<ClipInfo | null>>([]);
  const [cutCaptions, setCutCaptions] = useState<CutCaptionState[]>([]);
  const [cutGuideVisibility, setCutGuideVisibility] = useState<Record<number, boolean>>({});
  const [guideImageIndexByCut, setGuideImageIndexByCut] = useState<Record<number, number>>({});
  const [editingCaptionCutIndex, setEditingCaptionCutIndex] = useState<number | null>(null);
  const [isExampleOpen, setIsExampleOpen] = useState(false);
  const [isReelOpen, setIsReelOpen] = useState(false);
  const [exampleReelIndex, setExampleReelIndex] = useState(0);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
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
  const [exampleMediaLoadedByCutKey, setExampleMediaLoadedByCutKey] = useState<Record<string, boolean>>(
    {}
  );
  const [exampleMediaFailedByCutKey, setExampleMediaFailedByCutKey] = useState<Record<string, boolean>>(
    {}
  );
  const [captureScale, setCaptureScale] = useState(1);
  const [isCaptureMenuOpen, setIsCaptureMenuOpen] = useState(false);

  const isAdmin = user?.role?.toUpperCase() === USER_ROLES.ADMIN;
  const isGuestUser = Boolean(user?.guest || user?.provider === 'GUEST');
  const currentReelsMakerHref = templateId
    ? `/reels-maker?templateId=${encodeURIComponent(templateId)}`
    : '/reels-maker';
  const buildLoginHref = useCallback(
    (href: string) => `/login?returnUrl=${encodeURIComponent(href)}`,
    []
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
  const activeCaptionState = cutCaptions[activeCutIndex] ?? null;
  const activeCaptionText = activeCaptionState?.text ?? '';
  const activeCaptionStyle = activeCaptionState?.style ?? DEFAULT_CAPTION_STYLE;
  const hasCaptionText = Boolean(activeCaptionText.trim());
  const activeCutGuideText = activeCut?.guideText?.trim() || '등록된 컷 가이드가 없습니다.';
  const showCaptionOverlay =
    !activeUploadError &&
    !activeFixedError &&
    (!cameraError || Boolean(activeClip)) &&
    (!isActiveCutFixed || Boolean(activeClip));
  const isRecordDisabled =
    isActiveCutFixed || isUploadingActiveCut || isSessionLoading || !sessionId;
  const isGalleryDisabled =
    isActiveCutFixed ||
    isUploadingActiveCut ||
    isSessionLoading ||
    !sessionId ||
    recordingStatus === 'recording' ||
    isGalleryProcessing ||
    isTrimPreparing ||
    isTrimOpen;
  const isSwitchCameraDisabled =
    recordingStatus === 'recording' ||
    isActiveCutFixed ||
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
  const isGuideImageVisible =
    Boolean(guideImageSrc) && (cutGuideVisibility[activeCutIndex] ?? true);
  const activeCutKey = useMemo(() => {
    if (!template?.id || activeCut?.order == null) return null;
    return `${template.id}:${activeCut.order}`;
  }, [template?.id, activeCut?.order]);
  const activeCutExampleMedia = useMemo<ExampleMedia | null>(() => {
    const exampleImageUrl = activeCut?.exampleImageUrl?.trim();
    if (exampleImageUrl) {
      return {
        type: isVideoAssetUrl(exampleImageUrl) ? 'video' : 'image',
        src: exampleImageUrl,
      };
    }
    const exampleVideoUrl = activeCut?.exampleVideoUrl?.trim();
    if (exampleVideoUrl) {
      return {
        type: 'video',
        src: exampleVideoUrl,
      };
    }
    return null;
  }, [activeCut?.exampleImageUrl, activeCut?.exampleVideoUrl]);
  const isActiveExampleMediaLoaded = Boolean(
    activeCutKey && exampleMediaLoadedByCutKey[activeCutKey]
  );
  const isActiveExampleMediaFailed = Boolean(
    activeCutKey && exampleMediaFailedByCutKey[activeCutKey]
  );
  const shouldShowActiveCutExampleMedia = Boolean(
    activeCutExampleMedia && !isActiveExampleMediaFailed
  );
  const isActiveExampleMediaLoading = Boolean(
    isExampleOpen &&
      activeCutExampleMedia &&
      !isActiveExampleMediaLoaded &&
      !isActiveExampleMediaFailed
  );
  const handleActiveExampleMediaLoad = useCallback(() => {
    if (!activeCutKey) return;
    setExampleMediaLoadedByCutKey((prev) => ({
      ...prev,
      [activeCutKey]: true,
    }));
    setExampleMediaFailedByCutKey((prev) => ({
      ...prev,
      [activeCutKey]: false,
    }));
  }, [activeCutKey]);
  const handleActiveExampleMediaError = useCallback(() => {
    if (!activeCutKey) return;
    setExampleMediaFailedByCutKey((prev) => ({
      ...prev,
      [activeCutKey]: true,
    }));
    setExampleMediaLoadedByCutKey((prev) => ({
      ...prev,
      [activeCutKey]: false,
    }));
  }, [activeCutKey]);
  const exampleReelUrls = template?.exampleReelUrls ?? [];
  const hasExampleReels = exampleReelUrls.length > 0;
  const currentExampleReelUrl = exampleReelUrls[exampleReelIndex] ?? null;
  const isFirstExampleReel = exampleReelIndex <= 0;
  const isLastExampleReel = exampleReelIndex >= exampleReelUrls.length - 1;
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
  const recommendedTrimSeconds =
    activeCutDurationSeconds > 0 ? activeCutDurationSeconds : trimDurationSeconds;
  const minTrimDurationForSource = Math.min(
    MIN_TRIM_DURATION_SECONDS,
    trimSliderMax > 0 ? trimSliderMax : MIN_TRIM_DURATION_SECONDS
  );

  const resetCaptionGesture = useCallback(() => {
    const gesture = captionGestureRef.current;
    gesture.mode = 'none';
    gesture.pointerMap.clear();
    gesture.dragPointerId = null;
    gesture.startPointer = null;
    gesture.startStyle = null;
    gesture.startDistance = 0;
    gesture.startScale = 1;
  }, []);

  const updateCutCaptionAtIndex = useCallback(
    (index: number, updater: (current: CutCaptionState) => CutCaptionState) => {
      setCutCaptions((prev) => {
        const current = prev[index];
        if (!current) return prev;
        const next = [...prev];
        next[index] = updater(current);
        return next;
      });
    },
    []
  );

  const clampCaptionPosition = useCallback((rawXRatio: number, rawYRatio: number) => {
    const normalizedX = clampValue(rawXRatio, 0, 1);
    const normalizedY = clampValue(rawYRatio, 0, 1);

    const frameRect = cameraFrameRef.current?.getBoundingClientRect();
    if (!frameRect || frameRect.width <= 0 || frameRect.height <= 0) {
      return { xRatio: normalizedX, yRatio: normalizedY };
    }

    const overlayRect = captionOverlayRef.current?.getBoundingClientRect();
    const halfWidth = overlayRect
      ? Math.min(overlayRect.width / 2, frameRect.width / 2)
      : 0;
    const halfHeight = overlayRect
      ? Math.min(overlayRect.height / 2, frameRect.height / 2)
      : 0;

    const minX = halfWidth / frameRect.width;
    const maxX = 1 - minX;
    const minY = halfHeight / frameRect.height;
    const maxY = 1 - minY;

    return {
      xRatio: minX > maxX ? 0.5 : clampValue(normalizedX, minX, maxX),
      yRatio: minY > maxY ? 0.5 : clampValue(normalizedY, minY, maxY),
    };
  }, []);

  const applyClampedCaptionStyle = useCallback(
    (style: CaptionStyle) => {
      const normalized = normalizeCaptionStyle(style);
      const position = clampCaptionPosition(normalized.xRatio, normalized.yRatio);
      return {
        ...normalized,
        ...position,
      };
    },
    [clampCaptionPosition]
  );

  const updateActiveCaptionText = useCallback(
    (text: string) => {
      updateCutCaptionAtIndex(activeCutIndex, (current) => ({
        ...current,
        text,
      }));
    },
    [activeCutIndex, updateCutCaptionAtIndex]
  );

  const updateActiveCaptionStyle = useCallback(
    (updater: (style: CaptionStyle) => CaptionStyle) => {
      updateCutCaptionAtIndex(activeCutIndex, (current) => ({
        ...current,
        style: applyClampedCaptionStyle(updater(current.style)),
      }));
    },
    [activeCutIndex, applyClampedCaptionStyle, updateCutCaptionAtIndex]
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

  const handlePrevExampleReel = useCallback(() => {
    setExampleReelIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNextExampleReel = useCallback(() => {
    setExampleReelIndex((prev) => Math.min(exampleReelUrls.length - 1, prev + 1));
  }, [exampleReelUrls.length]);

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

    const metadata = await new Promise<VideoMetadata>((resolve, reject) => {
      const onLoadedMetadata = () => {
        cleanup();
        const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
        const width = video.videoWidth || 720;
        const height = video.videoHeight || 1280;
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

    video.src = '';
    return metadata;
  }, []);

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
        const normalized = {
          ...data,
          tags: Array.isArray(data?.tags) ? data.tags : [],
          cuts: Array.isArray(data?.cuts) ? data.cuts : [],
          exampleReelUrls: Array.isArray(data?.exampleReelUrls)
            ? data.exampleReelUrls.filter((url): url is string => {
                if (typeof url !== 'string') return false;
                return url.trim().length > 0;
              })
            : [],
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

    setIsSessionLoading(true);
    setSessionError(null);
    try {
      const response = await fetch('/api/reels-maker/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      });

      const payload: WebApiResponse<ReelsMakerSessionResponse> = await response.json();
      if (!response.ok || !payload?.success || !payload?.data) {
        throw new Error(payload?.message || '릴스 제작 세션을 생성하지 못했습니다.');
      }

      const session = payload.data;
      const mapping: Record<number, number> = {};
      (session.clips ?? []).forEach((clip) => {
        if (clip?.order != null && clip?.clipId != null) {
          mapping[clip.order] = clip.clipId;
        }
      });
      setSessionId(session.sessionId);
      setSessionClipMap(mapping);
    } catch (error: unknown) {
      setSessionError(getErrorMessage(error, '릴스 제작 세션을 생성하지 못했습니다.'));
      setSessionId(null);
      setSessionClipMap({});
    } finally {
      setIsSessionLoading(false);
    }
  }, [template, templateId]);

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
    setUploadedCuts({});
    setUploadingCuts({});
    setClipUploadErrors({});
    setCutCaptions(
      cuts.map((cut) => ({
        text: cut.defaultCaption,
        style: { ...DEFAULT_CAPTION_STYLE },
      }))
    );
    setCutGuideVisibility(() => {
      const next: Record<number, boolean> = {};
      cuts.forEach((cut, index) => {
        next[index] = parseGuideImageEntries(cut.guideImageUrl).length > 0;
      });
      return next;
    });
    setGuideImageIndexByCut({});
    setEditingCaptionCutIndex(null);
    resetCaptionGesture();
    setClips((prev) => {
      prev.forEach((clip) => clip?.url && URL.revokeObjectURL(clip.url));
      return Array(cuts.length).fill(null);
    });
    setFixedClipErrors({});
    setClipPosters({});
    setFinalVideoUrl((prev) => {
      revokeBlobUrl(prev);
      return null;
    });
    setFinalPosterUrl(null);
    setFinalVideoMimeType('video/mp4');
    setIsPreviewOpen(false);
    setExampleMediaLoadedByCutKey({});
    setExampleMediaFailedByCutKey({});
    setGalleryError(null);
    setIsGalleryProcessing(false);
    setIsTrimOpen(false);
    resetTrimState();
  }, [template?.id, cuts, resetCaptionGesture, resetTrimState]);

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
    if (!isReelOpen) {
      setExampleReelIndex(0);
    }
  }, [isReelOpen]);

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
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
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
    async (overrideFacingMode?: CameraFacingMode) => {
      const targetFacingMode = overrideFacingMode ?? cameraFacingMode;
      if (cameraSetupInProgressRef.current) {
        return;
      }

      cameraSetupInProgressRef.current = true;
      setCameraError(null);

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('이 브라우저에서는 카메라 기능을 사용할 수 없습니다.');
        cameraSetupInProgressRef.current = false;
        return;
      }

      try {
        let mediaStream: MediaStream | null = null;
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: targetFacingMode },
              aspectRatio: 9 / 16,
              width: { ideal: 1080 },
              height: { ideal: 1920 },
            },
            audio: true,
          });
        } catch {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: targetFacingMode } },
            audio: true,
          });
        }

        if (!mediaStream) {
          setCameraError('카메라를 시작하지 못했습니다.');
          return;
        }
        if (mediaStream.getAudioTracks().length === 0) {
          setCameraError('마이크 접근이 필요합니다. 권한을 허용해주세요.');
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }
        setStream((current) => {
          if (current && current !== mediaStream) {
            current.getTracks().forEach((track) => track.stop());
          }
          return mediaStream;
        });
      } catch {
        setCameraError('카메라/마이크 접근이 거부되었어요. 권한을 확인해주세요.');
      } finally {
        cameraSetupInProgressRef.current = false;
      }
    },
    [cameraFacingMode]
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
    if (stage === 'capture' && template) {
      if (!stream) {
        setupCamera();
      }
    } else {
      stopCamera();
    }
  }, [stage, setupCamera, stopCamera, stream, template]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    if (stream) {
      const playPromise = video.play();
      if (playPromise) {
        playPromise.catch(() => {
          // Autoplay can be blocked on some mobile browsers.
        });
      }
    }
  }, [activeCutIndex, isSessionLoading, shouldShowActiveClipPreview, stage, stream]);

  useEffect(() => {
    latestClipsRef.current = clips;
  }, [clips]);

  useEffect(() => {
    return () => {
      latestClipsRef.current.forEach((clip) => clip?.url && URL.revokeObjectURL(clip.url));
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

  const getSupportedMimeType = useCallback((types: string[]) => {
    if (!window.MediaRecorder) return null;
    return types.find((type) => MediaRecorder.isTypeSupported(type)) || null;
  }, []);

  const captureVideoSegmentToBlob = useCallback(
    async (
      sourceUrl: string,
      metadata: VideoMetadata,
      startSeconds: number,
      endSeconds: number
    ): Promise<{ blob: Blob; mimeType: string; duration: number }> => {
      const duration = Math.max(MIN_TRIM_DURATION_SECONDS, endSeconds - startSeconds);
      const preferredTypes = [
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
      ];
      const mimeType = getSupportedMimeType(preferredTypes);

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

      const width = metadata.width || video.videoWidth || 720;
      const height = metadata.height || video.videoHeight || 1280;
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

      const recorder = new MediaRecorder(combinedStream, mimeType ? { mimeType } : undefined);
      const chunks: BlobPart[] = [];

      const outputBlob = await new Promise<Blob>(async (resolve, reject) => {
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };
        recorder.onerror = () => reject(new Error('영상 구간 처리 중 오류가 발생했습니다.'));
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || 'video/webm' }));
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
        mimeType: outputBlob.type || mimeType || 'video/webm',
        duration,
      };
    },
    [getSupportedMimeType, seekVideoTo]
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

      const width = image.naturalWidth || 720;
      const height = image.naturalHeight || 1280;
      canvas.width = width;
      canvas.height = height;
      context.drawImage(image, 0, 0, width, height);

      const preferredTypes = [
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
      ];
      const mimeType = getSupportedMimeType(preferredTypes);
      const streamFromCanvas = canvas.captureStream(30);
      const recorder = new MediaRecorder(streamFromCanvas, mimeType ? { mimeType } : undefined);
      const chunks: BlobPart[] = [];
      const outputBlob = await new Promise<Blob>((resolve, reject) => {
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };
        recorder.onerror = () => reject(new Error('사진 변환 중 오류가 발생했습니다.'));
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || 'video/webm' }));
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
        mimeType: outputBlob.type || mimeType || 'video/webm',
        duration: Math.max(MIN_TRIM_DURATION_SECONDS, durationSeconds),
      };
    },
    [getSupportedMimeType]
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
    async (index: number, blob: Blob, mimeType: string) => {
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

        setUploadedCuts((prev) => ({ ...prev, [index]: true }));
      } finally {
        setUploadingCuts((prev) => ({ ...prev, [index]: false }));
      }
    },
    [cuts, sessionClipMap, sessionId]
  );

  const saveClipAtIndex = useCallback(
    async (
      index: number,
      clipPayload: { blob: Blob; mimeType: string; duration: number },
      shouldAdvanceToNextCut: boolean = true
    ) => {
      const { blob, mimeType, duration } = clipPayload;
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

      try {
        const poster = await createPosterFromClip({
          blob,
          url,
          duration,
          mimeType,
        });
        setClipPosters((prev) => ({
          ...prev,
          [index]: poster,
        }));
      } catch {
        // 포스터 생성 실패는 업로드를 막지 않는다.
      }

      await uploadRecordedClip(index, blob, mimeType);
      setRecordingStatus('done');
      setGalleryError(null);
      setCameraError(null);

      if (!shouldAdvanceToNextCut) return;
      if (index >= cuts.length - 1) return;

      const nextCaptureIndex = cuts.findIndex((cut, cutIndex) => cutIndex > index && !cut.isFixed);
      if (nextCaptureIndex !== -1) {
        setActiveCutIndex(nextCaptureIndex);
      } else {
        setActiveCutIndex(index + 1);
      }
    },
    [createPosterFromClip, cuts, uploadRecordedClip]
  );

  const openGalleryPicker = useCallback(() => {
    if (isGalleryDisabled) return;
    setGalleryError(null);
    setTrimError(null);
    galleryFileInputRef.current?.click();
  }, [isGalleryDisabled]);

  const handleGalleryFileChange = useCallback(
    async (event: ReactChangeEvent<HTMLInputElement>) => {
      const input = event.target;
      const file = input.files?.[0];
      input.value = '';
      if (!file) return;
      if (!activeCut || activeCut.isFixed) return;

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
          const targetDuration =
            activeCutDurationSeconds > 0
              ? activeCutDurationSeconds
              : DEFAULT_GALLERY_CLIP_DURATION_SECONDS;
          const converted = await imageToVideoBlob(file, targetDuration);
          await saveClipAtIndex(activeCutIndex, converted, true);
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

        const preferredDuration =
          activeCutDurationSeconds > 0
            ? Math.min(metadata.duration, activeCutDurationSeconds)
            : metadata.duration;
        const safeStart = 0;
        const safeEnd = Math.max(
          Math.min(metadata.duration, preferredDuration),
          Math.min(metadata.duration, minTrimDurationForSource)
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
      activeCut,
      activeCutDurationSeconds,
      activeCutIndex,
      generateTimelineThumbnails,
      imageToVideoBlob,
      loadVideoMetadataFromUrl,
      minTrimDurationForSource,
      saveClipAtIndex,
    ]
  );

  const handleTrimConfirm = useCallback(async () => {
    if (!trimSourceUrl || !trimSourceMetadata) {
      setTrimError('영상 정보가 없습니다.');
      return;
    }
    if (!activeCut || activeCut.isFixed) {
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
      await saveClipAtIndex(activeCutIndex, converted, true);
      closeTrimModal();
    } catch (error: unknown) {
      const message = getErrorMessage(error, '영상 구간을 처리하지 못했습니다.');
      setTrimError(message);
      setGalleryError(message);
    } finally {
      setIsGalleryProcessing(false);
    }
  }, [
    activeCut,
    activeCutIndex,
    captureVideoSegmentToBlob,
    closeTrimModal,
    minTrimDurationForSource,
    pauseTrimPlayback,
    saveClipAtIndex,
    trimDurationSeconds,
    trimEndSeconds,
    trimSourceMetadata,
    trimSourceUrl,
    trimStartSeconds,
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
  }, [getSupportedMimeType]);

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

  const startRecording = async () => {
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
      const recordedCut = cuts[recordedIndex];
      saveClipAtIndex(
        recordedIndex,
        {
          blob,
          duration: recordedCut?.durationSeconds ?? activeCut.durationSeconds,
          mimeType,
        },
        true
      ).catch((error: unknown) => {
        const message = getErrorMessage(error, '클립 업로드에 실패했습니다.');
        setClipUploadErrors((prev) => ({
          ...prev,
          [recordedIndex]: message,
        }));
        setUploadedCuts((prev) => ({ ...prev, [recordedIndex]: false }));
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
      setEditingCaptionCutIndex(null);
      resetCaptionGesture();
      if (isTrimOpen) {
        closeTrimModal();
      }
    }
  }, [closeTrimModal, isTrimOpen, resetCaptionGesture, stage, stopRecording]);

  const handleComplete = async () => {
    if (!sessionId) return;
    if (!allDone) return;

    const captions = cuts
      .map((cut, index) => {
        const order = cut.order ?? index + 1;
        const clipId = sessionClipMap[order];
        if (!clipId) return null;
        const captionState = cutCaptions[index];
        const captionStyle = buildCaptionExportStyle(
          captionState?.style ?? DEFAULT_CAPTION_STYLE,
          cameraFrameRef.current
        );
        return {
          clipId,
          caption: captionState?.text ?? '',
          captionStyle,
        };
      })
      .filter(
        (
          item
        ): item is {
          clipId: number;
          caption: string;
          captionStyle: CaptionStyle;
        } => item !== null
      );

    setProcessingStep(0);
    setStage('processing');
    const timers = [
      window.setTimeout(() => setProcessingStep(1), 1200),
      window.setTimeout(() => setProcessingStep(2), 2600),
    ];

    try {
      const response = await fetch(`/api/reels-maker/sessions/${sessionId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ captions }),
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
    } finally {
      timers.forEach((timer) => window.clearTimeout(timer));
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

  const distanceBetweenPoints = useCallback(
    (a: { x: number; y: number }, b: { x: number; y: number }) => {
      return Math.hypot(a.x - b.x, a.y - b.y);
    },
    []
  );

  const handleCaptionPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const gesture = captionGestureRef.current;
      if (!gesture.pointerMap.has(event.pointerId)) return;

      gesture.pointerMap.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });

      if (gesture.mode === 'pinch') {
        if (!gesture.startStyle || gesture.pointerMap.size < 2 || gesture.startDistance <= 0) {
          return;
        }

        const points = Array.from(gesture.pointerMap.values());
        const nextDistance = distanceBetweenPoints(points[0], points[1]);
        if (!Number.isFinite(nextDistance) || nextDistance <= 0) return;

        const nextScale = clampValue(
          gesture.startScale * (nextDistance / gesture.startDistance),
          MIN_CAPTION_SCALE,
          MAX_CAPTION_SCALE
        );
        updateActiveCaptionStyle(() => ({
          ...gesture.startStyle!,
          scale: nextScale,
        }));
        return;
      }

      if (
        gesture.mode === 'drag' &&
        gesture.dragPointerId === event.pointerId &&
        gesture.startPointer &&
        gesture.startStyle
      ) {
        const frameRect = cameraFrameRef.current?.getBoundingClientRect();
        if (!frameRect || frameRect.width <= 0 || frameRect.height <= 0) return;

        const deltaX = event.clientX - gesture.startPointer.x;
        const deltaY = event.clientY - gesture.startPointer.y;

        updateActiveCaptionStyle(() => ({
          ...gesture.startStyle!,
          xRatio: gesture.startStyle!.xRatio + deltaX / frameRect.width,
          yRatio: gesture.startStyle!.yRatio + deltaY / frameRect.height,
        }));
      }
    },
    [distanceBetweenPoints, updateActiveCaptionStyle]
  );

  const handleCaptionPointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const gesture = captionGestureRef.current;

      if (gesture.pointerMap.has(event.pointerId)) {
        gesture.pointerMap.delete(event.pointerId);
      }

      const target = event.currentTarget;
      if (target.hasPointerCapture(event.pointerId)) {
        target.releasePointerCapture(event.pointerId);
      }

      if (gesture.pointerMap.size === 0) {
        resetCaptionGesture();
        return;
      }

      if (gesture.mode === 'pinch') {
        if (gesture.pointerMap.size >= 2 && gesture.startStyle) {
          const points = Array.from(gesture.pointerMap.values());
          gesture.startDistance = distanceBetweenPoints(points[0], points[1]);
          gesture.startScale = activeCaptionStyle.scale;
          gesture.startStyle = { ...activeCaptionStyle };
          return;
        }
        resetCaptionGesture();
        return;
      }

      if (gesture.mode === 'drag' && gesture.dragPointerId === event.pointerId) {
        resetCaptionGesture();
      }
    },
    [activeCaptionStyle, distanceBetweenPoints, resetCaptionGesture]
  );

  const handleCaptionPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!showCaptionOverlay) return;
      if (editingCaptionCutIndex === activeCutIndex) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;

      event.stopPropagation();
      setEditingCaptionCutIndex(null);

      const gesture = captionGestureRef.current;
      gesture.pointerMap.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      event.currentTarget.setPointerCapture(event.pointerId);

      if (gesture.pointerMap.size >= 2) {
        if (!gesture.startStyle) {
          gesture.startStyle = { ...activeCaptionStyle };
        }
        gesture.mode = 'pinch';
        const points = Array.from(gesture.pointerMap.values());
        gesture.startDistance = distanceBetweenPoints(points[0], points[1]);
        gesture.startScale = activeCaptionStyle.scale;
        return;
      }

      gesture.mode = 'drag';
      gesture.dragPointerId = event.pointerId;
      gesture.startPointer = { x: event.clientX, y: event.clientY };
      gesture.startStyle = { ...activeCaptionStyle };
    },
    [
      activeCaptionStyle,
      activeCutIndex,
      distanceBetweenPoints,
      editingCaptionCutIndex,
      showCaptionOverlay,
    ]
  );

  const handleResizeHandlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const gesture = captionGestureRef.current;
      if (gesture.mode !== 'resize' || gesture.dragPointerId !== event.pointerId) return;
      if (!gesture.startStyle || !gesture.startPointer || gesture.startDistance <= 0) return;

      const frameRect = cameraFrameRef.current?.getBoundingClientRect();
      if (!frameRect || frameRect.width <= 0 || frameRect.height <= 0) return;

      const center = {
        x: frameRect.left + gesture.startStyle.xRatio * frameRect.width,
        y: frameRect.top + gesture.startStyle.yRatio * frameRect.height,
      };

      const currentDistance = distanceBetweenPoints(center, {
        x: event.clientX,
        y: event.clientY,
      });
      if (!Number.isFinite(currentDistance) || currentDistance <= 0) return;

      const nextScale = clampValue(
        gesture.startScale * (currentDistance / gesture.startDistance),
        MIN_CAPTION_SCALE,
        MAX_CAPTION_SCALE
      );

      updateActiveCaptionStyle(() => ({
        ...gesture.startStyle!,
        scale: nextScale,
      }));
    },
    [distanceBetweenPoints, updateActiveCaptionStyle]
  );

  const handleResizeHandlePointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const gesture = captionGestureRef.current;
      if (gesture.dragPointerId === event.pointerId) {
        const target = event.currentTarget;
        if (target.hasPointerCapture(event.pointerId)) {
          target.releasePointerCapture(event.pointerId);
        }
        resetCaptionGesture();
      }
    },
    [resetCaptionGesture]
  );

  const handleResizeHandlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!showCaptionOverlay) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;

      event.stopPropagation();
      setEditingCaptionCutIndex(null);

      const frameRect = cameraFrameRef.current?.getBoundingClientRect();
      if (!frameRect || frameRect.width <= 0 || frameRect.height <= 0) return;

      const center = {
        x: frameRect.left + activeCaptionStyle.xRatio * frameRect.width,
        y: frameRect.top + activeCaptionStyle.yRatio * frameRect.height,
      };
      const startPoint = { x: event.clientX, y: event.clientY };

      const gesture = captionGestureRef.current;
      gesture.mode = 'resize';
      gesture.pointerMap.clear();
      gesture.pointerMap.set(event.pointerId, startPoint);
      gesture.dragPointerId = event.pointerId;
      gesture.startPointer = startPoint;
      gesture.startStyle = { ...activeCaptionStyle };
      gesture.startScale = activeCaptionStyle.scale;
      gesture.startDistance = Math.max(
        1,
        distanceBetweenPoints(center, startPoint)
      );

      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [activeCaptionStyle, distanceBetweenPoints, showCaptionOverlay]
  );

  const handleCaptionTextChange = useCallback(
    (value: string) => {
      updateActiveCaptionText(value);
    },
    [updateActiveCaptionText]
  );

  const handleCaptionToggleBox = useCallback(() => {
    updateActiveCaptionStyle((current) => ({
      ...current,
      boxed: !current.boxed,
    }));
  }, [updateActiveCaptionStyle]);

  const ensureActiveCaptionInFrame = useCallback(() => {
    const current = cutCaptions[activeCutIndex];
    if (!current) return;

    const nextStyle = applyClampedCaptionStyle(current.style);
    if (
      Math.abs(nextStyle.xRatio - current.style.xRatio) < 0.0001 &&
      Math.abs(nextStyle.yRatio - current.style.yRatio) < 0.0001 &&
      Math.abs(nextStyle.scale - current.style.scale) < 0.0001 &&
      nextStyle.boxed === current.style.boxed
    ) {
      return;
    }

    updateCutCaptionAtIndex(activeCutIndex, (prev) => ({
      ...prev,
      style: nextStyle,
    }));
  }, [
    activeCutIndex,
    applyClampedCaptionStyle,
    cutCaptions,
    updateCutCaptionAtIndex,
  ]);

  useEffect(() => {
    if (!showCaptionOverlay) return;

    const frame = window.requestAnimationFrame(() => {
      ensureActiveCaptionInFrame();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    activeCutIndex,
    activeCaptionStyle.boxed,
    activeCaptionStyle.scale,
    activeCaptionStyle.xRatio,
    activeCaptionStyle.yRatio,
    activeCaptionText,
    ensureActiveCaptionInFrame,
    showCaptionOverlay,
  ]);

  useEffect(() => {
    const handleResize = () => {
      if (!showCaptionOverlay) return;
      ensureActiveCaptionInFrame();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [ensureActiveCaptionInFrame, showCaptionOverlay]);

  useEffect(() => {
    if (editingCaptionCutIndex !== activeCutIndex) return;
    const input = captionInputRef.current;
    if (!input) return;
    input.focus();
    const valueLength = input.value.length;
    input.setSelectionRange(valueLength, valueLength);
  }, [activeCutIndex, editingCaptionCutIndex]);

  useEffect(() => {
    setEditingCaptionCutIndex(null);
    resetCaptionGesture();
    setGalleryError(null);
    setTrimError(null);
  }, [activeCutIndex, resetCaptionGesture]);

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

  const handleResetAll = () => {
    setStage('capture');
    setProcessingStep(0);
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
    setCutCaptions(
      cuts.map((cut) => ({
        text: cut.defaultCaption,
        style: { ...DEFAULT_CAPTION_STYLE },
      }))
    );
    setCutGuideVisibility(() => {
      const next: Record<number, boolean> = {};
      cuts.forEach((cut, index) => {
        next[index] = parseGuideImageEntries(cut.guideImageUrl).length > 0;
      });
      return next;
    });
    setGuideImageIndexByCut({});
    setEditingCaptionCutIndex(null);
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
    setIsExampleOpen(false);
    setIsReelOpen(false);
    setExampleReelIndex(0);
    setIsResetOpen(false);
    setDownloadToastMessage(null);
    setGalleryError(null);
    setIsGalleryProcessing(false);
    setIsTrimOpen(false);
    resetTrimState();
    setupCamera();
    createReelsSession();
  };

  if (!templateId) {
    return (
      <div className="min-h-[100dvh] bg-black text-white flex items-center justify-center px-4">
        <div className="max-w-sm text-center text-sm text-white/70">
          템플릿 선택 화면으로 이동 중입니다...
        </div>
      </div>
    );
  }

  if (isTemplateLoading) {
    return (
      <div className="min-h-[100dvh] bg-black text-white flex items-center justify-center px-4">
        <div className="max-w-sm text-center text-sm text-white/70">
          템플릿 정보를 불러오는 중입니다...
        </div>
      </div>
    );
  }

  if (templateError || !template || cuts.length === 0) {
    return (
      <div className="min-h-[100dvh] bg-black text-white flex items-center justify-center px-4">
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

  if (isSessionLoading) {
    return (
      <div className="min-h-[100dvh] bg-black text-white flex items-center justify-center px-4">
        <div className="max-w-sm text-center text-sm text-white/70">
          릴스 제작 세션을 준비하는 중입니다...
        </div>
      </div>
    );
  }

  if (sessionError) {
    return (
      <div className="min-h-[100dvh] bg-black text-white flex items-center justify-center px-4">
        <div className="max-w-sm text-center space-y-4">
          <p className="text-sm text-white/70">{sessionError}</p>
          <button
            type="button"
            onClick={() => createReelsSession()}
            className="rounded-full bg-[#FF4D6D] px-4 py-2 text-sm font-semibold shadow-lg"
          >
            다시 시도하기
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'processing') {
    return (
      <div className="min-h-[100dvh] bg-black text-white flex items-center justify-center px-4">
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
      <div className="min-h-[100dvh] bg-black text-white">
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
            <InstagramShareButton
              finalVideoUrl={finalVideoUrl}
              finalVideoMimeType={finalVideoMimeType}
              templateTitle={template.title}
              onShared={setDownloadToastMessage}
            />
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
                    className="w-full aspect-[9/16] max-h-[70vh] object-cover"
                  />
                ) : (
                  <div className="w-full aspect-[9/16] max-h-[70vh] flex items-center justify-center text-white/70 text-sm">
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
    <div
      className="overflow-hidden bg-[#1E2A3B] text-white lg:bg-black"
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
      {isCaptureMenuOpen && (
        <div className="fixed inset-0 z-[80] bg-white text-gray-900">
          <nav
            className="flex h-full flex-col overflow-y-auto"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 px-5">
              <span className="text-lg font-bold">메뉴</span>
              <button
                type="button"
                onClick={() => setIsCaptureMenuOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700"
                aria-label="메뉴 닫기"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isAuthenticated && user && (
              <button
                type="button"
                onClick={() => {
                  setIsCaptureMenuOpen(false);
                  router.push('/profile');
                }}
                className="w-full border-b border-gray-200 bg-gray-50 px-6 py-4 text-left transition hover:bg-gray-100"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-gray-200 bg-gray-100">
                    {user.profileImageUrl ? (
                      <Image
                        src={user.profileImageUrl}
                        alt="프로필"
                        width={56}
                        height={56}
                        className="h-full w-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <User className="h-6 w-6 text-gray-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold">
                      {user.nickname || user.socialNickname || '사용자'}
                    </p>
                    {user.email && (
                      <p className="truncate text-sm text-gray-500">{user.email}</p>
                    )}
                    {!user.email && isGuestUser && (
                      <p className="truncate text-sm text-gray-500">가입 없이 이용 중</p>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" />
                </div>
              </button>
            )}

            <div className="flex-1 space-y-2 p-6">
              {isGuestUser && (
                <Link
                  href={buildLoginHref(currentReelsMakerHref)}
                  onClick={() => setIsCaptureMenuOpen(false)}
                  className="mb-4 flex w-full items-center justify-center rounded-xl bg-[#FF496D] px-5 py-3 text-base font-semibold text-white"
                >
                  회원가입하고 보관하기
                </Link>
              )}
              {!isAuthenticated && (
                <Link
                  href={buildLoginHref(currentReelsMakerHref)}
                  onClick={() => setIsCaptureMenuOpen(false)}
                  className="mb-4 flex w-full items-center justify-center rounded-xl bg-[#FF496D] px-5 py-3 text-base font-semibold text-white"
                >
                  로그인 / 회원가입
                </Link>
              )}

              {CAPTURE_MENU_ITEMS.map((item) => {
                const Icon = item.icon;
                const targetHref =
                  !isAuthenticated && item.requiresAuth ? buildLoginHref(item.href) : item.href;
                return (
                  <Link
                    key={item.href}
                    href={targetHref}
                    onClick={() => setIsCaptureMenuOpen(false)}
                    className="flex w-full items-center gap-3 rounded-xl px-5 py-3.5 text-lg font-medium text-gray-900 transition hover:bg-gray-50"
                  >
                    <Icon className="h-5 w-5 text-gray-600" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              <div className="my-2 border-t border-gray-200" />

              <Link
                href="/contents/script-creation"
                onClick={() => setIsCaptureMenuOpen(false)}
                className="block w-full rounded-xl px-5 py-3.5 text-lg font-medium text-gray-900 transition hover:bg-gray-50"
              >
                릴스 제작
              </Link>
              <Link
                href="/ranking"
                onClick={() => setIsCaptureMenuOpen(false)}
                className="block w-full rounded-xl px-5 py-3.5 text-lg font-medium text-gray-900 transition hover:bg-gray-50"
              >
                인기 급상승 릴스
              </Link>

              {isAuthenticated && isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setIsCaptureMenuOpen(false)}
                  className="block w-full rounded-xl px-5 py-3.5 text-lg font-medium text-gray-900 transition hover:bg-gray-50"
                >
                  관리자
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
      <div
        ref={captureViewportRef}
        className="h-full w-full overflow-hidden lg:mx-auto lg:max-w-[440px]"
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
                    onClick={() => router.push('/templates')}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/90 transition hover:bg-white/10"
                    aria-label="뒤로가기"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-semibold text-white/80">릴스 제작</span>
                      {recordingStatus === 'recording' && (
                        <span className="inline-flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#FF4D6D] px-2.5 text-[11px] font-semibold">
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                          REC
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsExampleOpen(true)}
                    className="h-10 shrink-0 rounded-full bg-[#FF4D6D] px-4 text-xs font-semibold shadow-lg"
                  >
                    예시 보기
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCaptureMenuOpen(true)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/90 transition hover:bg-white/10"
                    aria-label="메뉴"
                  >
                    <Menu className="h-6 w-6" />
                  </button>
                </div>

                <div
                  ref={cameraFrameRef}
                  className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden rounded-none bg-[#243246] lg:aspect-[9/16] lg:flex-none lg:rounded-[24px]"
                  onPointerDownCapture={(event) => {
                    if (editingCaptionCutIndex !== activeCutIndex) return;
                    const targetNode = event.target as Node;
                    if (captionOverlayRef.current?.contains(targetNode)) return;
                    setEditingCaptionCutIndex(null);
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
                      <video
                        src={activeClip.url}
                        muted
                        playsInline
                        preload="metadata"
                        poster={clipPosters[activeCutIndex] || undefined}
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
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="absolute inset-0 h-full w-full object-cover"
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
                      <div className="relative text-center text-white/40">
                        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full border border-white/20">
                          <Camera className="h-6 w-6 text-white/60" />
                        </div>
                        카메라 뷰
                      </div>
                    </>
                  )}

                  {showCaptionOverlay && (
                    <div
                      ref={captionOverlayRef}
                      onClick={(event) => {
                        event.stopPropagation();
                        setEditingCaptionCutIndex(activeCutIndex);
                      }}
                      onPointerDown={handleCaptionPointerDown}
                      onPointerMove={handleCaptionPointerMove}
                      onPointerUp={handleCaptionPointerEnd}
                      onPointerCancel={handleCaptionPointerEnd}
                      className="absolute z-20 max-w-[85%] select-none"
                      style={{
                        left: `${activeCaptionStyle.xRatio * 100}%`,
                        top: `${activeCaptionStyle.yRatio * 100}%`,
                        transform: 'translate(-50%, -50%)',
                        touchAction: 'none',
                        cursor:
                          editingCaptionCutIndex === activeCutIndex ? 'text' : 'move',
                        fontSize: `${Math.round(
                          CAPTION_BASE_FONT_SIZE_PX * activeCaptionStyle.scale
                        )}px`,
                        lineHeight: CAPTION_LINE_HEIGHT,
                        padding: activeCaptionStyle.boxed
                          ? `${Math.round(
                              CAPTION_BOX_PADDING_Y_PX * activeCaptionStyle.scale
                            )}px ${Math.round(
                              CAPTION_BOX_PADDING_X_PX * activeCaptionStyle.scale
                            )}px`
                          : '0px',
                        borderRadius: `${Math.round(
                          CAPTION_BOX_BORDER_RADIUS_PX * activeCaptionStyle.scale
                        )}px`,
                        backgroundColor: activeCaptionStyle.boxed
                          ? `rgba(0, 0, 0, ${CAPTION_BOX_BACKGROUND_OPACITY})`
                          : 'transparent',
                        boxShadow: activeCaptionStyle.boxed
                          ? '0 8px 20px rgba(0,0,0,0.28)'
                          : 'none',
                      }}
                    >
                      {editingCaptionCutIndex === activeCutIndex ? (
                        <input
                          ref={captionInputRef}
                          value={activeCaptionText}
                          onChange={(event) => handleCaptionTextChange(event.target.value)}
                          onBlur={() => setEditingCaptionCutIndex(null)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              setEditingCaptionCutIndex(null);
                            }
                          }}
                          onPointerDown={(event) => event.stopPropagation()}
                          placeholder="Text"
                          className="w-full min-w-[140px] max-w-[75vw] bg-transparent text-center font-semibold text-white placeholder:text-white/60 focus:outline-none"
                        />
                      ) : (
                        <span
                          className={`block text-center font-semibold whitespace-pre-wrap break-words ${
                            hasCaptionText ? 'text-white' : 'text-white/55'
                          }`}
                        >
                          {hasCaptionText ? activeCaptionText : 'Text'}
                        </span>
                      )}
                      {editingCaptionCutIndex !== activeCutIndex && (
                        <button
                          type="button"
                          onPointerDown={handleResizeHandlePointerDown}
                          onPointerMove={handleResizeHandlePointerMove}
                          onPointerUp={handleResizeHandlePointerEnd}
                          onPointerCancel={handleResizeHandlePointerEnd}
                          onClick={(event) => event.stopPropagation()}
                          className="absolute -right-3 -bottom-3 flex h-7 w-7 items-center justify-center rounded-full border border-white/40 bg-[#FF4D6D] text-[10px] font-bold text-white shadow-lg"
                          aria-label="텍스트 크기 조절"
                        >
                          ↔
                        </button>
                      )}
                    </div>
                  )}

                  <div className="pointer-events-none absolute inset-x-0 top-0 z-30 space-y-2 bg-gradient-to-b from-black/35 via-black/10 to-transparent px-3 pb-6 pt-3">
                    <div className="pointer-events-auto">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={handleGuideImageToggle}
                          disabled={!guideImageSrc}
                          className="h-10 min-w-0 w-full rounded-full border border-white/35 bg-white/15 px-2 text-[11px] leading-none font-semibold text-white whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          가이드 이미지 {isGuideImageVisible ? 'ON' : 'OFF'}
                        </button>
                        <button
                          type="button"
                          onClick={handleCaptionToggleBox}
                          disabled={!showCaptionOverlay}
                          className="h-10 min-w-0 w-full rounded-full border border-white/35 bg-white/15 px-2 text-[11px] leading-none font-semibold text-white whitespace-nowrap disabled:opacity-40"
                        >
                          텍스트 박스 {activeCaptionStyle.boxed ? 'ON' : 'OFF'}
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
                              className={`relative h-[92px] w-[52px] overflow-hidden rounded-xl border-2 transition-all ${
                                isActive ? 'border-[#FF4D6D] bg-white/10' : 'border-white/15 bg-black/30'
                              }`}
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
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <Plus className="h-6 w-6 text-white/45" />
                                </div>
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
                          );
                        })}
                      </div>

                      {allDone ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsResetOpen(true)}
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/35 bg-black/35 text-white/80"
                            aria-label="촬영 다시 시도"
                          >
                            <RotateCcw className="h-5 w-5" />
                          </button>
                          <button
                            type="button"
                            onClick={handleComplete}
                            className="h-12 w-full rounded-full bg-[#FF4D6D] px-4 text-sm font-semibold shadow-lg"
                          >
                            ✓ 완료하기
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="grid grid-cols-3 items-center">
                            <div className="flex justify-start">
                              <button
                                type="button"
                                onClick={openGalleryPicker}
                                disabled={isGalleryDisabled}
                                className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/35 bg-black/35 disabled:cursor-not-allowed disabled:opacity-45"
                                aria-label="갤러리에서 불러오기"
                              >
                                {isGalleryProcessing || isTrimPreparing ? (
                                  <Loader2 className="h-5 w-5 animate-spin text-white/75" />
                                ) : clipPosters[activeCutIndex] ? (
                                  <img
                                    src={clipPosters[activeCutIndex]}
                                    alt=""
                                    aria-hidden
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <ImageIcon className="h-5 w-5 text-white/80" />
                                )}
                              </button>
                            </div>
                            <div className="flex justify-center">
                              <button
                                type="button"
                                onClick={recordingStatus === 'recording' ? stopRecording : startRecording}
                                disabled={isRecordDisabled}
                                className={`relative flex h-20 w-20 items-center justify-center rounded-full border-4 shadow-2xl ${
                                  isRecordDisabled ? 'border-white/20' : 'border-[#FF4D6D]'
                                }`}
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
                          {(galleryError || trimError) && (
                            <p className="text-center text-xs text-rose-300">{galleryError || trimError}</p>
                          )}
                        </div>
                      )}

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

      {isExampleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-[28px] bg-[#1E2A3B] overflow-hidden relative">
            <button
              type="button"
              onClick={() => setIsExampleOpen(false)}
              className="absolute top-4 right-4 z-30 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
            {shouldShowActiveCutExampleMedia && (
              <div className="bg-black p-4 pb-3">
                <div className="relative mx-auto w-full max-w-[300px] aspect-[9/16] overflow-hidden rounded-[20px] bg-black">
                  {isActiveExampleMediaLoading && (
                    <div className="absolute inset-0 z-20 animate-pulse bg-white/10" />
                  )}
                  {activeCutExampleMedia.type === 'image' ? (
                    <>
                      <img
                        src={activeCutExampleMedia.src}
                        alt=""
                        aria-hidden
                        className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-xl"
                      />
                      <img
                        src={activeCutExampleMedia.src}
                        alt="예시 이미지"
                        className={`pointer-events-none absolute inset-0 z-10 h-full w-full object-contain transition-opacity duration-200 ${
                          isActiveExampleMediaLoaded ? 'opacity-100' : 'opacity-0'
                        }`}
                        onLoad={handleActiveExampleMediaLoad}
                        onError={handleActiveExampleMediaError}
                      />
                    </>
                  ) : (
                    <video
                      src={activeCutExampleMedia.src}
                      controls
                      playsInline
                      preload="metadata"
                      className={`absolute inset-0 z-10 h-full w-full object-contain transition-opacity duration-200 ${
                        isActiveExampleMediaLoaded ? 'opacity-100' : 'opacity-0'
                      }`}
                      onLoadedMetadata={handleActiveExampleMediaLoad}
                      onError={handleActiveExampleMediaError}
                    />
                  )}
                </div>
              </div>
            )}
            <div className={`p-5 space-y-4 ${shouldShowActiveCutExampleMedia ? '' : 'pt-16'}`}>
              <button
                type="button"
                onClick={() => {
                  if (!hasExampleReels) return;
                  setIsExampleOpen(false);
                  setExampleReelIndex(0);
                  setIsReelOpen(true);
                }}
                disabled={!hasExampleReels}
                className="w-full rounded-full bg-[#FF4D6D] py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
              >
                실제 릴스 보기
              </button>
              {!hasExampleReels && (
                <p className="text-xs text-center text-white/55">예시 릴스 준비 중입니다.</p>
              )}
              <div>
                <p className="text-sm font-semibold text-white/80 mb-2">이 컷의 포인트</p>
                <p className="text-xs text-white/60 leading-relaxed">{activeCutGuideText}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {isReelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <button
            type="button"
            onClick={() => {
              setIsReelOpen(false);
              setExampleReelIndex(0);
            }}
            className="absolute top-6 right-6 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-full max-w-sm">
            <div className="rounded-[28px] overflow-hidden bg-[#1E2A3B] p-4">
              <div className="relative rounded-[20px] overflow-hidden bg-black aspect-[9/16]">
                {currentExampleReelUrl ? (
                  <InstagramEmbed
                    url={currentExampleReelUrl}
                    className="absolute inset-0 h-full w-full rounded-none"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
                    예시 릴스가 없습니다.
                  </div>
                )}

                <button
                  type="button"
                  onClick={handlePrevExampleReel}
                  disabled={isFirstExampleReel}
                  className="absolute left-3 top-1/2 z-20 -translate-y-1/2 w-9 h-9 rounded-full bg-[#FF4D6D] text-white flex items-center justify-center disabled:opacity-35 disabled:cursor-not-allowed"
                  aria-label="이전 릴스"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={handleNextExampleReel}
                  disabled={isLastExampleReel}
                  className="absolute right-3 top-1/2 z-20 -translate-y-1/2 w-9 h-9 rounded-full bg-[#FF4D6D] text-white flex items-center justify-center disabled:opacity-35 disabled:cursor-not-allowed"
                  aria-label="다음 릴스"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-4 flex items-center justify-center gap-2">
                {exampleReelUrls.map((url, index) => (
                  <button
                    key={`${url}-${index}`}
                    type="button"
                    onClick={() => setExampleReelIndex(index)}
                    className={`h-2.5 rounded-full transition-all ${
                      index === exampleReelIndex ? 'w-6 bg-[#FF4D6D]' : 'w-2.5 bg-white/35'
                    }`}
                    aria-label={`${index + 1}번 릴스로 이동`}
                    aria-current={index === exampleReelIndex}
                  />
                ))}
              </div>

              <p className="mt-3 text-center text-xs text-white/60">
                좌우 버튼 또는 하단 점을 눌러 다른 예시 릴스를 확인하세요.
              </p>
              {currentExampleReelUrl && (
                <a
                  href={currentExampleReelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-[#FF4D6D] py-3 text-sm font-semibold text-white hover:brightness-105 transition"
                >
                  Instagram에서 열기
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {isTrimOpen && (
        <div
          ref={trimViewportRef}
          className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-black/80 py-2"
        >
          <div className="w-full max-w-sm px-4">
            <div
              ref={trimMeasureRef}
              className="w-full overflow-hidden rounded-[24px] bg-[#1E2A3B] text-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <h3 className="text-sm font-semibold">영상 구간 선택</h3>
                <button
                  type="button"
                  onClick={closeTrimModal}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10"
                  aria-label="구간 선택 닫기"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4 p-4">
                <div className="flex justify-center">
                  {trimSourceUrl ? (
                    <div
                      ref={trimPreviewContainerRef}
                      className="relative aspect-[9/16] overflow-hidden rounded-[18px] bg-black"
                      style={{
                        width: trimPreviewMaxHeight
                          ? `min(100%, ${Math.floor(trimPreviewMaxHeight * 9 / 16)}px)`
                          : '100%',
                        maxHeight: trimPreviewMaxHeight
                          ? `${trimPreviewMaxHeight}px`
                          : undefined,
                      }}
                    >
                      <video
                        ref={trimPreviewVideoRef}
                        src={trimSourceUrl}
                        playsInline
                        preload="metadata"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={handleTrimPlayToggle}
                        className="absolute bottom-3 left-3 z-10 inline-flex items-center gap-2 rounded-full bg-black/65 px-3 py-2 text-xs font-semibold text-white backdrop-blur"
                        aria-label={isTrimPlaying ? '구간 재생 일시정지' : '선택 구간 재생'}
                      >
                        {isTrimPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        {isTrimPlaying ? '일시정지' : '재생'}
                      </button>
                    </div>
                  ) : (
                    <div
                      ref={trimPreviewContainerRef}
                      className="flex aspect-[9/16] items-center justify-center rounded-[18px] bg-black text-xs text-white/60"
                      style={{
                        width: trimPreviewMaxHeight
                          ? `min(100%, ${Math.floor(trimPreviewMaxHeight * 9 / 16)}px)`
                          : '100%',
                        maxHeight: trimPreviewMaxHeight
                          ? `${trimPreviewMaxHeight}px`
                          : undefined,
                      }}
                    >
                      영상 미리보기를 준비하는 중입니다...
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div
                    ref={trimTimelineRef}
                    className="relative h-20 rounded-xl border border-white/10 bg-black/40 touch-none select-none"
                    onPointerDown={handleTrimScrubPointerDown}
                  >
                    <div className="absolute inset-0 overflow-hidden rounded-xl">
                      {trimThumbnails.length > 0 ? (
                        <div className="flex h-full">
                          {trimThumbnails.map((thumbnail, index) => (
                            <img
                              key={`${thumbnail}-${index}`}
                              src={thumbnail}
                              alt=""
                              aria-hidden
                              className="min-w-0 flex-1 object-cover"
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="flex h-full items-center justify-center text-[11px] text-white/55">
                          타임라인 미리보기 생성 중...
                        </div>
                      )}
                      {trimSliderMax > 0 && (
                        <>
                          <div
                            className="pointer-events-none absolute inset-y-0 left-0 bg-black/60"
                            style={{ width: `${secondsToTimelineX(trimStartSeconds)}%` }}
                          />
                          <div
                            className="pointer-events-none absolute inset-y-0 right-0 bg-black/60"
                            style={{ width: `${100 - secondsToTimelineX(trimEndSeconds)}%` }}
                          />
                        </>
                      )}
                    </div>
                    {trimSliderMax > 0 && (
                      <>
                        <div
                          className={`absolute inset-y-0 z-20 rounded-md border-2 bg-white/10 ${
                            activeTrimDrag === 'window' ? 'border-[#4DE8FF]' : 'border-white/90'
                          }`}
                          style={{
                            left: `${secondsToTimelineX(trimStartSeconds)}%`,
                            width: `${Math.max(
                              0.5,
                              secondsToTimelineX(trimEndSeconds) - secondsToTimelineX(trimStartSeconds)
                            )}%`,
                          }}
                          onPointerDown={(event) => handleTrimPointerDown(event, 'window')}
                        />
                        <div
                          className="absolute inset-y-0 z-30 w-6 -translate-x-1/2 cursor-ew-resize touch-none"
                          style={{ left: `${secondsToTimelineX(trimStartSeconds)}%` }}
                          onPointerDown={(event) => handleTrimPointerDown(event, 'start')}
                        >
                          <div
                            className={`mx-auto h-full w-[3px] rounded-full ${
                              activeTrimDrag === 'start' ? 'bg-[#4DE8FF]' : 'bg-white'
                            }`}
                          />
                        </div>
                        <div
                          className="absolute inset-y-0 z-30 w-6 -translate-x-1/2 cursor-ew-resize touch-none"
                          style={{ left: `${secondsToTimelineX(trimEndSeconds)}%` }}
                          onPointerDown={(event) => handleTrimPointerDown(event, 'end')}
                        >
                          <div
                            className={`mx-auto h-full w-[3px] rounded-full ${
                              activeTrimDrag === 'end' ? 'bg-[#4DE8FF]' : 'bg-white'
                            }`}
                          />
                        </div>
                        <div
                          className="absolute z-40 w-7 -translate-x-1/2 cursor-ew-resize touch-none"
                          style={{
                            left: `${secondsToTimelineX(trimScrubSeconds)}%`,
                            top: '-4px',
                            height: 'calc(100% + 8px)',
                          }}
                          onPointerDown={(event) => handleTrimPointerDown(event, 'scrub')}
                        >
                          <div className="pointer-events-none absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]" />
                        </div>
                      </>
                    )}
                  </div>

                  <p className="text-center text-xs text-white/70">
                    {trimScrubSeconds.toFixed(1)}s
                  </p>

                  <p className="text-center text-xs text-white/70">
                    선택 구간 {trimDurationSeconds.toFixed(1)}초 / 권장 {recommendedTrimSeconds.toFixed(1)}초
                  </p>
                </div>

                {trimError && <p className="text-center text-xs text-rose-300">{trimError}</p>}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closeTrimModal}
                    disabled={isGalleryProcessing}
                    className="flex-1 rounded-xl bg-white/10 py-2 text-sm disabled:opacity-50"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleTrimConfirm}
                    disabled={isGalleryProcessing || !trimSourceFile || !trimSourceMetadata}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#00C7E6] py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    {isGalleryProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    확인
                  </button>
                </div>
              </div>
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

export default function ReelsMakerPage() {
  return (
    <Suspense fallback={null}>
      <ReelsMakerInner />
    </Suspense>
  );
}
