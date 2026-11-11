'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ImageOff, Play } from 'lucide-react';
import { useUiText } from '@/app/i18n/LocaleProvider';
import InstagramEmbed from '@/app/components/ui/InstagramEmbed';

export type TemplateMediaPreviewProps = {
  title: string;
  thumbnailUrl?: string | null;
  embedUrl?: string | null;
  instagramOnly?: boolean;
  imageClassName?: string;
  embedClassName?: string;
  fallbackClassName?: string;
  disableEmbedInteraction?: boolean;
  playable?: boolean;
  onPlaybackFallbackVisibilityChange?: (isVisible: boolean) => void;
};

function safeUrl(value?: string | null) {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value.trim(), 'https://reelstamp.co.kr');
    return ['https:', 'http:'].includes(url.protocol) ? value.trim() : undefined;
  } catch { return undefined; }
}

export default function TemplateMediaPreview(props: TemplateMediaPreviewProps) {
  const playable = !!props.playable && !props.disableEmbedInteraction;
  return <MediaSession key={`${props.embedUrl ?? ''}:${playable}`} {...props} playable={playable} />;
}

function MediaSession({
  title, thumbnailUrl, embedUrl, instagramOnly = false,
  imageClassName = '', embedClassName = '', fallbackClassName = '',
  playable = false, onPlaybackFallbackVisibilityChange,
}: TemplateMediaPreviewProps) {
  const t = useUiText();
  const poster = safeUrl(thumbnailUrl);
  const source = safeUrl(embedUrl);
  const [failedPoster, setFailedPoster] = useState<string>();
  const [playing, setPlaying] = useState(false);
  const [failedVideo, setFailedVideo] = useState(false);
  const instagram = source && /(^|\.)instagram\.com$/i.test(new URL(source, 'https://reelstamp.co.kr').hostname);

  return (
    <div className="absolute inset-0">
      {playing && playable && source && !failedVideo ? (
        instagram ? (
          <InstagramEmbed
            url={source}
            className={`h-full w-full rounded-none ${embedClassName}`}
            instagramOnly={instagramOnly}
            onPlaybackFallbackVisibilityChange={onPlaybackFallbackVisibilityChange}
          />
        ) : <PreviewVideo src={source} title={title} onError={() => setFailedVideo(true)} />
      ) : poster && failedPoster !== poster ? (
        <Image
          src={poster} alt={title} fill
          sizes="(min-width: 1024px) 360px, (min-width: 640px) 320px, 78vw"
          className={`object-cover ${imageClassName}`}
          onError={() => setFailedPoster(poster)}
        />
      ) : (
        <div className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-gray-800 ${fallbackClassName}`}>
          <ImageOff className="h-6 w-6 text-white/50" aria-label={t('미리보기 이미지가 없습니다.')} />
        </div>
      )}
      {playable && source && !playing && !failedVideo && (
        <button type="button" aria-label={t('예시 영상 재생')}
          data-instagram-playback-trigger="true"
          onClick={() => setPlaying(true)}
          className="absolute left-1/2 top-1/2 z-10 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
          <Play className="h-5 w-5" fill="currentColor" aria-hidden="true" />
        </button>
      )}
      {failedVideo && <p role="status" className="absolute bottom-2 inset-x-2 rounded bg-black/70 p-2 text-center text-xs text-white">{t('미디어를 불러오지 못했어요.')}</p>}
    </div>
  );
}

function PreviewVideo({ src, title, onError }: { src: string; title: string; onError: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    return () => { if (video) { video.pause(); video.removeAttribute('src'); video.load(); } };
  }, []);
  return <video ref={ref} src={src} controls autoPlay playsInline preload="metadata"
    aria-label={title} onError={onError} className="h-full w-full bg-black object-contain" />;
}
