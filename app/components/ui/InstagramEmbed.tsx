// Instagram Embed 컴포넌트: 직접 iframe 방식
'use client';

import {
  type MouseEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import InstagramPlaybackFallback from '@/app/components/ui/InstagramPlaybackFallback';
import { INSTAGRAM_PLAYBACK_TRIGGER_ATTRIBUTE } from '@/app/lib/ui/instagramPlaybackTrigger';

const DEFAULT_LOAD_TIMEOUT_MS = 5000;
const IFRAME_RENDER_DELAY_MS = 300;
const PLAYBACK_CLICK_MOVE_THRESHOLD_PX = 12;

interface InstagramEmbedProps {
  url: string; // Instagram 릴스 URL
  className?: string; // 추가 CSS 클래스
  onLoadComplete?: () => void; // 로딩 완료 콜백
  instagramOnly?: boolean; // 앱 내 재생 불가로 표시할 릴스 여부
  showPlaybackFallback?: boolean; // 안내 오버레이 노출 여부
  onPlaybackFallbackVisibilityChange?: (isVisible: boolean) => void;
}

type InstagramEmbedUrls = {
  canonicalUrl: string;
  embedUrl: string;
};

type InstagramEmbedState = {
  url: string;
  isLoading: boolean;
  isFallbackVisible: boolean;
};

const createLoadingState = (url: string): InstagramEmbedState => ({
  url,
  isLoading: true,
  isFallbackVisible: false,
});

const getInstagramShortcode = (url: string) => {
  const match = url.match(/\/(?:reel|p|tv)\/([^/?#]+)/);
  return match ? match[1] : null;
};

const resolveInstagramEmbedUrls = (url: string): InstagramEmbedUrls => {
  const trimmedUrl = url.trim();
  const shortcode = getInstagramShortcode(trimmedUrl);

  if (!shortcode) {
    return {
      canonicalUrl: trimmedUrl,
      embedUrl: trimmedUrl,
    };
  }

  const canonicalUrl = `https://www.instagram.com/reel/${shortcode}/`;

  return {
    canonicalUrl,
    embedUrl: `${canonicalUrl}embed/`,
  };
};

export default function InstagramEmbed({
  url,
  className = '',
  onLoadComplete,
  instagramOnly = false,
  showPlaybackFallback = true,
  onPlaybackFallbackVisibilityChange,
}: InstagramEmbedProps) {
  const { canonicalUrl, embedUrl } = useMemo(
    () => resolveInstagramEmbedUrls(url),
    [url]
  );
  const resetKey = [
    url,
    instagramOnly ? 'instagram-only' : 'embeddable',
    instagramOnly && showPlaybackFallback
      ? 'fallback-enabled'
      : 'fallback-disabled',
  ].join(':');

  return (
    <InstagramEmbedFrame
      key={resetKey}
      url={url}
      canonicalUrl={canonicalUrl}
      embedUrl={embedUrl}
      className={className}
      onLoadComplete={onLoadComplete}
      instagramOnly={instagramOnly}
      showPlaybackFallback={showPlaybackFallback}
      onPlaybackFallbackVisibilityChange={onPlaybackFallbackVisibilityChange}
    />
  );
}

type InstagramEmbedFrameProps = InstagramEmbedProps & InstagramEmbedUrls;

function InstagramEmbedFrame({
  url,
  canonicalUrl,
  embedUrl,
  className = '',
  onLoadComplete,
  instagramOnly = false,
  showPlaybackFallback = true,
  onPlaybackFallbackVisibilityChange,
}: InstagramEmbedFrameProps) {
  const [embedState, setEmbedState] = useState<InstagramEmbedState>(() =>
    createLoadingState(url)
  );
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iframeRenderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasCompletedLoadRef = useRef(false);
  const onLoadCompleteRef = useRef(onLoadComplete);
  const onPlaybackFallbackVisibilityChangeRef = useRef(
    onPlaybackFallbackVisibilityChange
  );
  const playbackPointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const hasPlaybackPointerMovedRef = useRef(false);

  const isCurrentUrlState = embedState.url === url;
  const isLoading =
    !instagramOnly && (isCurrentUrlState ? embedState.isLoading : true);
  const canShowPlaybackFallback = instagramOnly && showPlaybackFallback;
  const isFallbackVisible =
    canShowPlaybackFallback &&
    isCurrentUrlState &&
    embedState.isFallbackVisible;
  const shouldInterceptPlaybackAttempt =
    canShowPlaybackFallback && !isFallbackVisible;

  useEffect(() => {
    onLoadCompleteRef.current = onLoadComplete;
  }, [onLoadComplete]);

  useEffect(() => {
    onPlaybackFallbackVisibilityChangeRef.current =
      onPlaybackFallbackVisibilityChange;
  }, [onPlaybackFallbackVisibilityChange]);

  useEffect(() => {
    onPlaybackFallbackVisibilityChangeRef.current?.(isFallbackVisible);
  }, [isFallbackVisible]);

  useEffect(() => {
    return () => {
      onPlaybackFallbackVisibilityChangeRef.current?.(false);
    };
  }, []);

  const clearLoadTimeout = useCallback(() => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
  }, []);

  const clearIframeRenderTimer = useCallback(() => {
    if (iframeRenderTimerRef.current) {
      clearTimeout(iframeRenderTimerRef.current);
      iframeRenderTimerRef.current = null;
    }
  }, []);

  const completeLoadOnce = useCallback(() => {
    if (hasCompletedLoadRef.current) {
      return;
    }

    hasCompletedLoadRef.current = true;
    onLoadCompleteRef.current?.();
  }, []);

  // URL 또는 재생 정책이 바뀌면 새 프레임 상태에서 로딩 타이머를 설정한다.
  useEffect(() => {
    hasCompletedLoadRef.current = false;
    clearLoadTimeout();
    clearIframeRenderTimer();

    if (instagramOnly) {
      completeLoadOnce();
      return () => {
        clearLoadTimeout();
        clearIframeRenderTimer();
      };
    }

    loadTimeoutRef.current = setTimeout(() => {
      loadTimeoutRef.current = null;
      setEmbedState({
        url,
        isLoading: false,
        isFallbackVisible: false,
      });
      completeLoadOnce();
    }, DEFAULT_LOAD_TIMEOUT_MS);

    return () => {
      clearLoadTimeout();
      clearIframeRenderTimer();
    };
  }, [
    url,
    instagramOnly,
    clearLoadTimeout,
    clearIframeRenderTimer,
    completeLoadOnce,
  ]);

  const handleIframeLoad = () => {
    if (instagramOnly) {
      return;
    }

    clearLoadTimeout();
    clearIframeRenderTimer();

    // iframe이 로드된 후 약간의 지연을 두고 로딩 완료 처리
    // (Instagram 콘텐츠가 완전히 렌더링될 시간을 줌)
    iframeRenderTimerRef.current = setTimeout(() => {
      setEmbedState({
        url,
        isLoading: false,
        isFallbackVisible: false,
      });
      completeLoadOnce();
    }, IFRAME_RENDER_DELAY_MS);
  };

  const resetPlaybackPointer = () => {
    playbackPointerStartRef.current = null;
    hasPlaybackPointerMovedRef.current = false;
  };

  const beginPlaybackPointerTracking = (clientX: number, clientY: number) => {
    playbackPointerStartRef.current = {
      x: clientX,
      y: clientY,
    };
    hasPlaybackPointerMovedRef.current = false;
  };

  const trackPlaybackPointerMove = (clientX: number, clientY: number) => {
    const start = playbackPointerStartRef.current;

    if (!start) {
      return;
    }

    const deltaX = clientX - start.x;
    const deltaY = clientY - start.y;
    const distance = Math.hypot(deltaX, deltaY);

    if (distance > PLAYBACK_CLICK_MOVE_THRESHOLD_PX) {
      hasPlaybackPointerMovedRef.current = true;
    }
  };

  const handlePlaybackPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    beginPlaybackPointerTracking(event.clientX, event.clientY);
  };

  const handlePlaybackPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    trackPlaybackPointerMove(event.clientX, event.clientY);
  };

  const handlePlaybackPointerCancel = () => {
    resetPlaybackPointer();
  };

  const handlePlaybackMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
    beginPlaybackPointerTracking(event.clientX, event.clientY);
  };

  const handlePlaybackMouseMove = (event: MouseEvent<HTMLButtonElement>) => {
    trackPlaybackPointerMove(event.clientX, event.clientY);
  };

  const handlePlaybackAttempt = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (hasPlaybackPointerMovedRef.current) {
      resetPlaybackPointer();
      return;
    }

    resetPlaybackPointer();
    setEmbedState({
      url,
      isLoading: false,
      isFallbackVisible: true,
    });
  };

  const handleFallbackCancel = () => {
    setEmbedState({
      url,
      isLoading: false,
      isFallbackVisible: false,
    });
  };

  return (
    <div className={`relative w-full h-full overflow-hidden rounded-lg bg-black ${className}`}>
      {/* 로딩 오버레이 - 각 embed마다 개별 로딩 표시 */}
      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin"></div>
            <div className="text-gray-400 text-sm font-medium">로딩 중...</div>
          </div>
        </div>
      )}

      {/* Instagram embed iframe */}
      <iframe
        src={embedUrl}
        className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
        allowFullScreen={true}
        frameBorder="0"
        allow="autoplay; encrypted-media"
        scrolling="no"
        onLoad={handleIframeLoad}
        title="Instagram 릴스"
      />

      {shouldInterceptPlaybackAttempt && (
        <button
          type="button"
          {...{ [INSTAGRAM_PLAYBACK_TRIGGER_ATTRIBUTE]: 'true' }}
          aria-label="인스타그램 릴스 재생"
          onPointerDown={handlePlaybackPointerDown}
          onPointerMove={handlePlaybackPointerMove}
          onPointerCancel={handlePlaybackPointerCancel}
          onMouseDown={handlePlaybackMouseDown}
          onMouseMove={handlePlaybackMouseMove}
          onClick={handlePlaybackAttempt}
          className="absolute inset-0 z-10 cursor-pointer bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white/70"
        />
      )}

      {isFallbackVisible && (
        <InstagramPlaybackFallback
          instagramUrl={canonicalUrl}
          onCancel={handleFallbackCancel}
        />
      )}
    </div>
  );
}
