'use client';
import { showAppToast } from '@/app/lib/ui/toast';
import { useUiLocale, useUiText } from '@/app/i18n/LocaleProvider';


import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { TemplateSummary } from '@/app/hooks/useSavedTemplates';
import { useTemplateCreation } from '@/app/hooks/useTemplateCreation';
import { isComingSoonTemplate } from '@/app/lib/templates/access';
import { useTemplateSwipe } from './useTemplateSwipe';
import TemplatePreviewCard from './TemplatePreviewCard';

export type TemplatePreviewSelection = {
  templates: TemplateSummary[];
  initialTemplateId: string;
};

type Props = TemplatePreviewSelection & {
  returnUrl: string;
  savedSet: Set<string>;
  saveError: string | null;
  onToggleSave: (template: TemplateSummary) => Promise<void>;
  onClose: () => void;
};

export default function TemplatePreviewModal({
  templates, initialTemplateId, returnUrl, savedSet, saveError, onToggleSave, onClose,
}: Props) {
  const t = useUiText();
  const { locale } = useUiLocale();
  const openedLocale = useRef(locale);
  useEffect(() => {
    if (openedLocale.current !== locale) {
      onClose();
      showAppToast({ message: t("언어가 변경되었습니다. 템플릿을 다시 선택해 주세요.") });
    }
  }, [locale, onClose, t]);
  const availableTemplates = useMemo(() => templates.filter(template => !isComingSoonTemplate(template)), [templates]);
  const [activeIndex, setActiveIndex] = useState(() => availableTemplates.findIndex(template => template.id === initialTemplateId));
  const [isSaving, setIsSaving] = useState(false);
  const [playbackFallbackTemplateId, setPlaybackFallbackTemplateId] = useState<string | null>(null);
  const savingRef = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const { create, isAccessLoading, accessMessage } = useTemplateCreation(returnUrl);
  const activeTemplate = availableTemplates[activeIndex];
  const previous = () => setActiveIndex(index => Math.max(0, index - 1));
  const next = () => setActiveIndex(index => Math.min(availableTemplates.length - 1, index + 1));
  const swipeHandlers = useTemplateSwipe(previous, next);
  const handlePlaybackFallback = useCallback((templateId: string, isVisible: boolean) => {
    setPlaybackFallbackTemplateId(current => isVisible ? templateId : current === templateId ? null : current);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, []);

  const save = async () => {
    if (!activeTemplate || savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    try {
      await onToggleSave(activeTemplate);
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  if (!activeTemplate || openedLocale.current !== locale) return null;
  const accessLoading = isAccessLoading(activeTemplate);

  return createPortal(
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-x-hidden overflow-y-auto overscroll-contain border-0 bg-black/80 p-0 text-white backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      aria-labelledby={titleId}
      aria-modal="true"
      onCancel={event => { event.preventDefault(); onClose(); }}
      onKeyDown={event => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key === 'Tab') {
          const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], iframe, [tabindex="0"]',
          )).filter(element => !element.closest('[inert]') && element.getClientRects().length > 0);
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
        if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          if (event.key === 'ArrowLeft') previous();
          else next();
        }
      }}
    >
      <button ref={closeRef} type="button" onClick={onClose} aria-label={t("상세 닫기")}
        className="absolute right-5 top-5 z-[90] flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-6 sm:top-6">
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
      <div className="flex min-h-full w-full flex-col items-center justify-center px-4 py-16 sm:px-8 sm:py-20">
        <p className="sr-only" aria-live="polite">{t(activeIndex + 1)} / {t(availableTemplates.length)} {t(" · 좌우로 넘겨보세요")}</p>
        <div
          className="relative left-1/2 flex h-[370px] w-screen max-w-none shrink-0 -translate-x-1/2 touch-pan-y select-none items-center justify-center overflow-hidden overscroll-x-none pb-2 sm:h-[470px] sm:pb-3 md:h-[490px] lg:h-[510px] self-start"
          {...swipeHandlers} aria-label={t("템플릿 좌우 탐색")}>
          {availableTemplates.map((template, index) => (
            <TemplatePreviewCard
              key={template.id}
              template={template}
              offset={index - activeIndex}
              titleId={titleId}
              isSaved={savedSet.has(template.id)}
              isSaving={isSaving}
              isPlaybackFallbackVisible={playbackFallbackTemplateId === template.id}
              onSave={save}
              onPlaybackFallbackVisibilityChange={isVisible => handlePlaybackFallback(template.id, isVisible)}
            />
          ))}
          <button type="button" onClick={previous}
            className="absolute left-4 top-1/2 z-50 -translate-y-1/2 w-11 h-11 rounded-full bg-[#FF4D6D] shadow-lg flex items-center justify-center hover:scale-105 transition-transform sm:left-8 disabled:invisible"
            disabled={activeIndex === 0} aria-label={t("이전 템플릿")}>
            <ChevronLeft className="h-5 w-5 text-white" aria-hidden="true" />
          </button>
          <button type="button" onClick={next}
            className="absolute right-4 top-1/2 z-50 -translate-y-1/2 w-11 h-11 rounded-full bg-[#FF4D6D] shadow-lg flex items-center justify-center hover:scale-105 transition-transform sm:right-8 disabled:invisible"
            disabled={activeIndex === availableTemplates.length - 1} aria-label={t("다음 템플릿")}>
            <ChevronRight className="h-5 w-5 text-white" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-0 flex w-full flex-col items-center gap-3 sm:gap-4">
          {saveError && <p role="alert" className="w-full max-w-md text-center text-sm font-semibold text-rose-300">{t(saveError)}</p>}
          {accessMessage && <p role="alert" className="w-full max-w-md text-center text-sm font-semibold text-rose-300">{t(accessMessage)}</p>}
          <button type="button" disabled={accessLoading} onClick={() => create(activeTemplate)}
            className="w-full max-w-md py-4 text-base sm:text-lg font-semibold rounded-full bg-[#FF4D6D] hover:bg-[#FF5F7A] transition-colors shadow-lg disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/50 disabled:shadow-none">
            {t(accessLoading ? '권한 확인 중...' : '3분 만에 만들러 가기')}
          </button>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
