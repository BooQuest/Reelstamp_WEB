'use client';

import { useState } from 'react';
import { Loader2, Share2, X } from 'lucide-react';

type InstagramShareModalType = 'desktop' | 'unsupported' | 'error';

type InstagramShareButtonProps = {
  finalVideoUrl: string | null;
  finalVideoMimeType: string;
  templateTitle?: string | null;
  onShared?: (message: string) => void;
};

const INSTAGRAM_SHARE_MODAL_COPY: Record<
  InstagramShareModalType,
  { title: string; description: string; detail: string }
> = {
  desktop: {
    title: '모바일에서 공유해 주세요',
    description: 'PC에서는 Instagram 앱으로 영상을 바로 전달할 수 없습니다.',
    detail: '이 화면은 그대로 유지됩니다. 아래 영상 다운로드 버튼으로 파일을 저장한 뒤 휴대폰이나 Instagram에서 직접 업로드해 주세요.',
  },
  unsupported: {
    title: '공유를 바로 열 수 없습니다',
    description: '현재 브라우저에서는 영상 파일 공유를 지원하지 않습니다.',
    detail: '영상 다운로드 버튼으로 파일을 저장한 뒤 Instagram 앱에서 직접 업로드해 주세요.',
  },
  error: {
    title: '공유 준비에 실패했습니다',
    description: '영상을 공유할 수 있는 파일로 준비하지 못했습니다.',
    detail: '네트워크 상태를 확인한 뒤 다시 시도하거나, 영상 다운로드 후 Instagram에서 직접 업로드해 주세요.',
  },
};

const isLikelyMobileDevice = () => {
  if (typeof navigator === 'undefined') return false;

  const userAgent = navigator.userAgent || '';
  const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;

  return isMobileUserAgent || isIPadOS;
};

const guessShareVideoExtension = (mimeType: string, url: string) => {
  const lowerMimeType = mimeType.toLowerCase();
  if (lowerMimeType.includes('webm')) return 'webm';
  if (lowerMimeType.includes('quicktime')) return 'mov';
  if (lowerMimeType.includes('mp4')) return 'mp4';

  const pathname = url.split(/[?#]/)[0]?.toLowerCase() ?? '';
  if (pathname.endsWith('.webm')) return 'webm';
  if (pathname.endsWith('.mov')) return 'mov';
  if (pathname.endsWith('.m4v')) return 'm4v';
  return 'mp4';
};

export default function InstagramShareButton({
  finalVideoUrl,
  finalVideoMimeType,
  templateTitle,
  onShared,
}: InstagramShareButtonProps) {
  const [modalType, setModalType] = useState<InstagramShareModalType | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const modalCopy = modalType ? INSTAGRAM_SHARE_MODAL_COPY[modalType] : null;

  const handleShare = async () => {
    if (!finalVideoUrl || isSharing) return;

    if (!isLikelyMobileDevice()) {
      setModalType('desktop');
      return;
    }

    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
      setModalType('unsupported');
      return;
    }

    setIsSharing(true);

    try {
      const downloadUrl = `/api/reels-maker/download?url=${encodeURIComponent(finalVideoUrl)}`;
      const response = await fetch(downloadUrl, { cache: 'no-store' });

      if (!response.ok) {
        throw new Error('영상 파일을 불러오지 못했습니다.');
      }

      const contentType = response.headers.get('content-type') || finalVideoMimeType || 'video/mp4';
      const blob = await response.blob();
      const extension = guessShareVideoExtension(blob.type || contentType, finalVideoUrl);
      const file = new File([blob], `reelstamp-reel.${extension}`, {
        type: blob.type || contentType,
      });
      const shareData: ShareData = {
        title: templateTitle ? `${templateTitle} 릴스` : '릴스탬프 릴스',
        text: '릴스탬프에서 만든 릴스입니다.',
        files: [file],
      };

      if (typeof navigator.canShare === 'function' && !navigator.canShare(shareData)) {
        setModalType('unsupported');
        return;
      }

      await navigator.share(shareData);
      onShared?.('공유 창을 열었어요.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      console.error('[ReelsMaker] Instagram share failed:', error);
      setModalType('error');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleShare}
        disabled={!finalVideoUrl || isSharing}
        className="w-full rounded-full bg-[#FF4D6D] py-4 text-base font-semibold shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {isSharing ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Share2 className="w-5 h-5" />
        )}
        {isSharing ? '공유 준비 중...' : '인스타그램에 공유'}
      </button>

      {modalCopy && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setModalType(null)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-[24px] border border-white/15 bg-[#121A2A] p-6 text-white shadow-2xl">
            <button
              type="button"
              onClick={() => setModalType(null)}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80"
              aria-label="닫기"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[#FF4D6D]/20 text-[#FF8AA0]">
              <Share2 className="h-5 w-5" />
            </div>
            <h2 className="pr-10 text-lg font-bold">{modalCopy.title}</h2>
            <p className="mt-3 text-sm leading-6 text-white/75">
              {modalCopy.description}
            </p>
            <p className="mt-2 text-sm leading-6 text-white/60">
              {modalCopy.detail}
            </p>
            <button
              type="button"
              onClick={() => setModalType(null)}
              className="mt-6 w-full rounded-full bg-[#FF4D6D] py-3 text-sm font-semibold text-white shadow-lg"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}
