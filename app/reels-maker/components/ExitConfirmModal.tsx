type Props = {
  isGuestUser: boolean;
  isSaving: boolean;
  onSaveAndExit: () => void;
  onExitWithoutSaving: () => void;
  onContinue: () => void;
};

export default function ExitConfirmModal({
  isGuestUser,
  isSaving,
  onSaveAndExit,
  onExitWithoutSaving,
  onContinue,
}: Props) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 px-4">
      <div className="w-full max-w-sm rounded-3xl bg-[#172235] p-6 text-white shadow-2xl">
        <h2 className="text-lg font-bold">작업을 종료하시겠습니까?</h2>
        <p className="mt-3 text-sm leading-6 text-white/70">
          {isGuestUser
            ? '게스트의 미완성 프로젝트는 저장되지 않으며, 나가면 업로드한 원본 영상과 작업 내용을 즉시 삭제합니다.'
            : '저장하지 않고 나가면 마지막 자동 저장 이후의 변경사항은 반영되지 않습니다. 미완성 프로젝트는 마지막 저장일로부터 30일 동안 보관됩니다.'}
        </p>
        <div className="mt-6 space-y-2">
          <button
            type="button"
            onClick={onSaveAndExit}
            disabled={isSaving}
            className="flex h-12 w-full items-center justify-center rounded-full bg-[#FF4D6D] text-sm font-semibold disabled:opacity-50"
          >
            {isSaving
              ? '처리 중...'
              : isGuestUser
                ? '삭제하고 나가기'
                : '저장 후 나가기'}
          </button>
          {!isGuestUser && (
            <button
              type="button"
              onClick={onExitWithoutSaving}
              disabled={isSaving}
              className="h-12 w-full rounded-full border border-white/20 text-sm font-semibold text-white/85 disabled:opacity-50"
            >
              저장하지 않고 나가기
            </button>
          )}
          <button
            type="button"
            onClick={onContinue}
            disabled={isSaving}
            className="h-12 w-full text-sm font-semibold text-white/60 disabled:opacity-50"
          >
            계속 작업하기
          </button>
        </div>
      </div>
    </div>
  );
}
