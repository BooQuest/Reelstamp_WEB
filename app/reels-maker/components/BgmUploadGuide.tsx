'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Copy, Download, Music2, X } from 'lucide-react';
import { openBgmPage, type RecommendedBgm } from '../utils/bgm';
import { dismissBgmGuide } from '../utils/bgmGuidePreference';
import { isAppleMobileDevice, isLikelyMobileDevice } from '../utils/device';

type Props = {
  bgm: RecommendedBgm;
  onDownload: () => void;
  onClose: () => void;
};

export default function BgmUploadGuide({ bgm, onDownload, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [copyMessage, setCopyMessage] = useState('');
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const isDesktop = !isLikelyMobileDevice();

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previousFocus?.focus();
    };
  }, []);

  const downloadAndOpen = () => {
    if (dontShowAgain) dismissBgmGuide();
    onDownload();
    openBgmPage(bgm.url);
    onClose();
  };

  const closeWithPreference = () => {
    if (dontShowAgain) dismissBgmGuide();
    onClose();
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(bgm.url);
      setCopyMessage('BGM 링크를 복사했어요.');
    } catch {
      setCopyMessage('복사하지 못했어요. 아래 주소를 길게 누르거나 선택해서 복사해 주세요.');
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-[24px] border border-white/15 bg-[#121A2A] p-0 text-white shadow-2xl backdrop:bg-black/75"
    >
      <div className="relative p-6">
        <button type="button" onClick={closeWithPreference} aria-label="BGM 안내 닫기"
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
          <X className="h-4 w-4" />
        </button>
        <Music2 className="mb-3 h-6 w-6 text-[#FF8AA0]" aria-hidden="true" />
        <h2 id={titleId} className="pr-7 text-lg font-bold">BGM과 함께 업로드</h2>
        <p className="mt-2 break-words text-sm text-[#FF8AA0]">{bgm.title}</p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-white/80">
          <li>아래 버튼으로 영상을 다운로드해 주세요.</li>
          <li>함께 열리는 Instagram 음원 페이지에서 <strong>오디오 사용 / Use audio</strong>를 눌러 주세요.</li>
          <li>갤러리에서 저장한 영상을 선택하고, 음원 구간과 볼륨을 확인한 뒤 게시해 주세요.</li>
        </ol>
        {isAppleMobileDevice() && (
          <p className="mt-3 rounded-xl bg-white/5 p-3 text-xs leading-5 text-white/70">
            파일 앱에 저장되었다면 영상을 열고 공유 메뉴의 ‘비디오 저장’을 눌러 사진 앱에 저장해 주세요.
          </p>
        )}
        {isDesktop && (
          <p className="mt-3 rounded-xl bg-white/5 p-3 text-xs leading-5 text-white/70">
            PC에서 다운로드한 영상은 휴대폰으로 옮겨 주세요. BGM 링크를 휴대폰에서 열고 Instagram 앱에서 진행해 주세요.
          </p>
        )}
        <div className="mt-5 space-y-3">
          <label className="flex cursor-pointer items-center gap-2 py-1 text-sm text-white/80">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(event) => setDontShowAgain(event.target.checked)}
              className="h-4 w-4 accent-[#FF4D6D]"
            />
            다시 보지 않기
          </label>
          <button type="button" onClick={downloadAndOpen}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#FF4D6D] px-3 py-3 text-sm font-semibold">
            <Download className="h-4 w-4" aria-hidden="true" />영상 다운로드 후 BGM 열기
          </button>
          {isDesktop && (
            <>
              <button type="button" onClick={copyLink} className="flex w-full items-center justify-center gap-2 py-2 text-sm text-white/80">
                <Copy className="h-4 w-4" aria-hidden="true" />BGM 링크 복사
              </button>
              <input aria-label="BGM 링크" readOnly value={bgm.url} onFocus={(event) => event.target.select()}
                className="w-full rounded-lg bg-white/5 px-3 py-2 text-xs text-white/70" />
              <p role="status" className="text-xs leading-5 text-white/70">{copyMessage}</p>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
