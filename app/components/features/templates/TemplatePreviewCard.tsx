'use client';
import { useUiText } from '@/app/i18n/LocaleProvider';


import { Bookmark } from 'lucide-react';
import type { TemplateSummary } from '@/app/hooks/useSavedTemplates';
import { resolveTemplateAccessType } from '@/app/lib/templates/access';
import TemplateAccessBadge from '@/app/components/ui/TemplateAccessBadge';
import TemplateMediaPreview from '@/app/components/ui/TemplateMediaPreview';

type Props = {
  template: TemplateSummary;
  offset: number;
  titleId: string;
  isSaved: boolean;
  isSaving: boolean;
  isPlaybackFallbackVisible: boolean;
  onSave: () => void;
  onPlaybackFallbackVisibilityChange: (isVisible: boolean) => void;
};

export default function TemplatePreviewCard({
  template, offset, titleId, isSaved, isSaving, isPlaybackFallbackVisible,
  onSave, onPlaybackFallbackVisibilityChange,
}: Props) {
  const t = useUiText();
  const isActive = offset === 0;
  const distance = Math.abs(offset);
  const offsetY = offset > 0 ? 8 + (distance - 1) * 8 : 22 + (distance - 1) * 12;
  const scale = Math.max(0.88, 0.95 - (distance - 1) * 0.04);
  const brightness = distance === 1 ? 0.85 : Math.max(0.68, 0.8 - (distance - 1) * 0.08);

  return (
    <div
      className="absolute left-1/2 top-1/2 w-[78vw] max-w-[360px] sm:w-[320px] lg:w-[360px] aspect-[3/4] rounded-[28px] overflow-hidden shadow-2xl transition-all duration-500 ease-out motion-reduce:transition-none"
      data-position={offset}
      aria-hidden={!isActive}
      inert={!isActive}
      style={{
        zIndex: isActive ? isPlaybackFallbackVisible ? 80 : 30 : 30 - distance,
        opacity: 1,
        filter: `brightness(${isActive ? 1 : brightness})`,
        transform: isActive
          ? 'translate(-50%, -50%) translateX(0%) translateY(0px) scale(1)'
          : `translate(-50%, -50%) translateX(${offset * 58}%) translateY(${offsetY}px) scale(${scale})`,
        pointerEvents: isActive ? 'auto' : 'none',
      }}
    >
      <TemplateMediaPreview
        title={template.title}
        thumbnailUrl={template.thumbnailUrl}
        embedUrl={template.embedUrl}
        instagramOnly={template.instagramOnly}
        preferEmbed
        disableEmbedInteraction={!isActive}
        onPlaybackFallbackVisibilityChange={onPlaybackFallbackVisibilityChange}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/80" />
      <TemplateAccessBadge
        accessType={resolveTemplateAccessType(template)}
        className="pointer-events-none absolute left-4 top-4 z-40"
      />
      <button type="button" onClick={onSave} disabled={isSaving}
        aria-pressed={isSaved} aria-label={t.format(isSaved ? '{v0} 저장 취소' : '{v0} 저장', {v0: template.title})}
        className="absolute top-4 right-4 z-40 w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center hover:bg-white/30 transition-colors disabled:opacity-50">
        <Bookmark className={isSaved ? 'text-[#FF4D6D]' : 'text-white'} fill={isSaved ? '#FF4D6D' : 'none'} aria-hidden="true" />
      </button>
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 px-5 pb-6 pt-12">
        <h2 id={isActive ? titleId : undefined} className="text-xl sm:text-2xl font-bold mb-2 drop-shadow-lg">
          {template.title}
        </h2>
        <p className="text-sm text-white/80 mb-4 leading-relaxed line-clamp-2">{template.subtitle}</p>
        <div className="flex flex-wrap gap-2">
          {template.tags.map((tag, index) => (
            <span key={`${tag}-${index}`} className="px-3 py-1 text-xs font-semibold rounded-full bg-white/15 text-white/90">
              #{tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
