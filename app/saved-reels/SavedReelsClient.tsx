'use client';
import { useUiText } from '@/app/i18n/LocaleProvider';


import { useState } from 'react';
import { Bookmark, Play } from 'lucide-react';
import { useSavedTemplates, type TemplateSummary } from '@/app/hooks/useSavedTemplates';
import TemplateMediaPreview from '@/app/components/ui/TemplateMediaPreview';
import TemplateAccessBadge from '@/app/components/ui/TemplateAccessBadge';
import TemplatePreviewModal, { type TemplatePreviewSelection } from '@/app/components/features/templates/TemplatePreviewModal';
import { isComingSoonTemplate, resolveTemplateAccessType } from '@/app/lib/templates/access';

export default function SavedReelsClient() {
  const t = useUiText();
  const { savedTemplates, savedSet, isLoading, error, toggleSave } = useSavedTemplates({
    returnUrl: '/saved-reels',
  });
  const [preview, setPreview] = useState<TemplatePreviewSelection | null>(null);

  const handleOpen = (template: TemplateSummary) => {
    if (isComingSoonTemplate(template)) return;
    // Keep this browsing session stable when a template is unsaved in the modal.
    setPreview({ templates: [...savedTemplates], initialTemplateId: template.id });
  };

  if (isLoading) {
    return (
      <div className="py-16 text-center text-sm sm:text-base text-gray-500">
        {t("저장된 릴스를 불러오는 중입니다...")}</div>
    );
  }

  return (
    <div className="space-y-4">
      {error && !preview && <p role="alert" className="py-4 text-sm text-rose-500">{t(error)}</p>}
      {!error && savedTemplates.length === 0 && (
        <p className="py-16 text-center text-sm sm:text-base text-gray-500">{t("저장된 릴스가 없습니다.")}</p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
        {savedTemplates.map((template) => {
          const isComingSoon = isComingSoonTemplate(template);

          return (
            <div key={template.id} className="group">
              <div className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden bg-white shadow-sm ring-1 ring-black/5">
                <button
                  type="button"
                  onClick={() => handleOpen(template)}
                  aria-label={t.format("{v0} 상세 보기", {v0: template.title})}
                  disabled={isComingSoon}
                  className="relative block h-full w-full disabled:cursor-not-allowed"
                >
                  {isComingSoon ? (
                    <span className="absolute left-2 top-2 z-10 flex h-9 items-center rounded-full bg-white/90 px-3 text-[11px] font-extrabold text-gray-900 shadow-sm ring-1 ring-black/10 sm:left-3 sm:top-3 sm:text-xs">
                      {t("추가 예정")}</span>
                  ) : (
                    <TemplateAccessBadge
                      accessType={resolveTemplateAccessType(template)}
                      className="absolute left-2 top-2 z-10 sm:left-3 sm:top-3"
                    />
                  )}
                  <TemplateMediaPreview
                    title={template.title}
                    thumbnailUrl={template.thumbnailUrl}
                    embedUrl={template.embedUrl}
                    instagramOnly={template.instagramOnly}
                    disableEmbedInteraction
                    imageClassName={
                      isComingSoon
                        ? 'saturate-[0.75]'
                        : 'transition-transform duration-300 group-hover:scale-[1.03]'
                    }
                  />
                  {isComingSoon ? (
                    <div className="absolute inset-0 bg-black/25" />
                  ) : (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/70 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                          <Play className="w-5 h-5 text-white" />
                        </div>
                      </div>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => toggleSave(template)}
                  aria-pressed
                  aria-label={t.format("{v0} 저장 취소", {v0: template.title})}
                  className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/70 text-[#FF4D6D] flex items-center justify-center shadow"
                >
                  <Bookmark className="w-4 h-4" fill="#FF4D6D" />
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                    <button type="button" onClick={() => handleOpen(template)} disabled={isComingSoon}
                      className="max-w-full truncate text-left disabled:cursor-not-allowed">
                      {template.title}
                    </button>
                  </h3>
                  <p className="text-xs text-gray-500 line-clamp-1">{template.subtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpen(template)}
                  disabled={isComingSoon}
                  className="shrink-0 px-3 py-2 text-xs font-semibold rounded-full bg-[#FF4D6D] text-white hover:bg-[#FF5F7A] transition-colors disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {t(isComingSoon ? '추가 예정' : '상세 보기')}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {preview && (
        <TemplatePreviewModal
          key={preview.initialTemplateId}
          {...preview}
          returnUrl="/saved-reels"
          savedSet={savedSet}
          saveError={error}
          onToggleSave={toggleSave}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
