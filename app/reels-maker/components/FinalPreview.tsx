'use client';
import { useUiText } from '@/app/i18n/LocaleProvider';


import { useState } from 'react';
import { Check, Download, Music2, Play, X } from 'lucide-react';
import InstagramShareButton from '../InstagramShareButton';
import { EXAMPLE_ASSETS } from '../constants';
import { openBgmPage, resolveRecommendedBgm } from '../utils/bgm';
import { isBgmGuideDismissed } from '../utils/bgmGuidePreference';
import BgmUploadGuide from './BgmUploadGuide';

type Props = {
  sessionId: number | null;
  finalVideoUrl: string | null;
  finalVideoMimeType: string;
  finalPosterUrl: string | null;
  templateTitle: string;
  bgmTitle?: string | null;
  bgmUrl?: string | null;
  downloadToastMessage: string | null;
  isPreviewOpen: boolean;
  onOpenPreview: () => void;
  onClosePreview: () => void;
  onDownload: () => void;
  onDone: () => void;
  onReady?: () => void;
  onShared: (message: string | null) => void;
};

export default function FinalPreview({
  sessionId,
  finalVideoUrl,
  finalVideoMimeType,
  finalPosterUrl,
  templateTitle,
  bgmTitle,
  bgmUrl,
  downloadToastMessage,
  isPreviewOpen,
  onOpenPreview,
  onClosePreview,
  onDownload,
  onDone,
  onShared,
  onReady,
}: Props) {
  const t = useUiText();
  const [isBgmGuideOpen, setIsBgmGuideOpen] = useState(false);
  const bgm = resolveRecommendedBgm(bgmTitle, bgmUrl);

  const handleBgmUpload = () => {
    if (!bgm || !finalVideoUrl || !sessionId) return;
    if (isBgmGuideDismissed()) {
      onDownload();
      openBgmPage(bgm.url);
    } else {
      setIsBgmGuideOpen(true);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-black text-white">
      <div className="max-w-md mx-auto px-4 pt-4 pb-10 space-y-6">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-center">
          <h1 className="text-center text-lg font-semibold">{t("릴스 제작 완료")}</h1>
          <button
            type="button"
            onClick={onDone}
            className="justify-self-end rounded-full px-3 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/10"
          >
            {t("완료")}</button>
        </header>

        <div className="rounded-[28px] bg-[#1E2A3B] p-4 shadow-2xl space-y-4">
          <div className="relative rounded-[24px] overflow-hidden">
            <div className="aspect-[9/16] bg-black flex items-center justify-center">
              {finalVideoUrl ? (
                <video
                  src={finalVideoUrl}
                  muted
                  playsInline
                  preload="auto"
                  onLoadedData={onReady}
                  poster={finalPosterUrl || undefined}
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  src={EXAMPLE_ASSETS.exampleImage}
                  alt={t("미리보기")}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                type="button"
                onClick={onOpenPreview}
                disabled={!finalVideoUrl}
                className="w-16 h-16 rounded-full bg-white/70 flex items-center justify-center backdrop-blur shadow-lg"
              >
                <Play className="w-8 h-8 text-white" />
              </button>
            </div>
            {bgm && (
              <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-start gap-2 rounded-xl bg-black/60 px-3 py-2 text-xs leading-5 backdrop-blur-sm">
                <Music2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 break-words">{t("추천 BGM · ")}{bgm.title}</span>
              </div>
            )}
            {downloadToastMessage && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold flex items-center gap-2 shadow-lg">
                <Check className="w-4 h-4" />
                {t(downloadToastMessage)}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {bgm && (
            <button type="button" onClick={handleBgmUpload} disabled={!finalVideoUrl || !sessionId}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#FF4D6D] py-4 text-base font-semibold shadow-lg disabled:opacity-50">
              <Music2 className="h-5 w-5" aria-hidden="true" />{t("BGM과 함께 업로드")}</button>
          )}
          <InstagramShareButton
            sessionId={sessionId}
            finalVideoUrl={finalVideoUrl}
            finalVideoMimeType={finalVideoMimeType}
            templateTitle={templateTitle}
            onShared={onShared}
            variant={bgm ? 'secondary' : 'primary'}
          />
          <button
            type="button"
            onClick={onDownload}
            disabled={!finalVideoUrl}
            className="w-full rounded-full bg-[#2B3446] py-4 text-base font-semibold shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Download className="w-5 h-5" />
            {t("영상 다운로드")}</button>
        </div>
      </div>

      {isBgmGuideOpen && bgm && (
        <BgmUploadGuide bgm={bgm} onDownload={onDownload} onClose={() => setIsBgmGuideOpen(false)} />
      )}

      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <button
            type="button"
            onClick={onClosePreview}
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
                  {t("영상 준비 중...")}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
