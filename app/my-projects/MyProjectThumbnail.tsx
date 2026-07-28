'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';

type MyProjectThumbnailProps = {
  projectThumbnailUrl?: string | null;
  projectThumbnailContentType?: string | null;
  templateThumbnailUrl?: string | null;
  alt: string;
};

const IMAGE_EXTENSION_PATTERN = /\.(avif|gif|jpe?g|png|webp)(?:[?#]|$)/i;

const withInitialFrameFragment = (src: string) => {
  if (src.includes('#')) return src;
  return `${src}#t=0.001`;
};

export default function MyProjectThumbnail({
  projectThumbnailUrl,
  projectThumbnailContentType,
  templateThumbnailUrl,
  alt,
}: MyProjectThumbnailProps) {
  const [failedProjectSrc, setFailedProjectSrc] = useState<string | null>(null);
  const projectSrc = projectThumbnailUrl?.trim() || '';
  const templateSrc = templateThumbnailUrl?.trim() || '';
  const contentType = projectThumbnailContentType?.trim().toLowerCase() || '';
  const projectMediaFailed = failedProjectSrc === projectSrc;

  const isProjectImage = useMemo(() => {
    if (!projectSrc) return false;
    if (contentType.startsWith('image/')) return true;
    if (contentType.startsWith('video/')) return false;
    return IMAGE_EXTENSION_PATTERN.test(projectSrc);
  }, [contentType, projectSrc]);

  if (projectSrc && !projectMediaFailed) {
    if (isProjectImage) {
      return (
        <Image
          src={projectSrc}
          alt={alt}
          fill
          sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
          onError={() => setFailedProjectSrc(projectSrc)}
        />
      );
    }

    return (
      <video
        key={projectSrc}
        src={withInitialFrameFragment(projectSrc)}
        muted
        playsInline
        preload="auto"
        className="h-full w-full object-cover"
        aria-label={alt}
        onError={() => setFailedProjectSrc(projectSrc)}
      />
    );
  }

  if (templateSrc) {
    return (
      <Image
        src={templateSrc}
        alt={alt}
        fill
        sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
        className="object-cover"
      />
    );
  }

  return (
    <div className="flex h-full items-center justify-center text-sm text-white/35">
      썸네일 없음
    </div>
  );
}
