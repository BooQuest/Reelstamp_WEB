'use client';

import Image from 'next/image';
import { Play } from 'lucide-react';
import InstagramEmbed from '@/app/components/ui/InstagramEmbed';

type TemplateMediaPreviewProps = {
  title: string;
  thumbnailUrl?: string | null;
  embedUrl?: string | null;
  imageClassName?: string;
  embedClassName?: string;
  fallbackClassName?: string;
  disableEmbedInteraction?: boolean;
  preferEmbed?: boolean;
};

export default function TemplateMediaPreview({
  title,
  thumbnailUrl,
  embedUrl,
  imageClassName = '',
  embedClassName = '',
  fallbackClassName = '',
  disableEmbedInteraction = false,
  preferEmbed = false,
}: TemplateMediaPreviewProps) {
  const thumbnailSrc = thumbnailUrl?.trim();
  const embedSrc = embedUrl?.trim();

  if (embedSrc && (preferEmbed || !thumbnailSrc)) {
    return (
      <div
        className={`absolute inset-0 ${
          disableEmbedInteraction ? 'pointer-events-none' : ''
        }`}
      >
        <InstagramEmbed
          url={embedSrc}
          className={`h-full w-full rounded-none ${embedClassName}`}
        />
      </div>
    );
  }

  if (thumbnailSrc) {
    return (
      <Image
        src={thumbnailSrc}
        alt={title}
        fill
        sizes="(min-width: 1024px) 360px, (min-width: 640px) 320px, 78vw"
        className={`object-cover ${imageClassName}`}
      />
    );
  }

  return (
    <div
      className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-gray-800 ${fallbackClassName}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white">
        <Play className="h-5 w-5" />
      </div>
    </div>
  );
}
