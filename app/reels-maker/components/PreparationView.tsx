import type { SaveState } from '../gallery/sourceSync';

type Props = {
  state: SaveState;
  error: string | null;
  onRetry: () => void;
  onBack: () => void;
};

export default function PreparationView({
  state,
  error,
  onRetry,
  onBack,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black text-white"
      role="status"
    >
      <div className="space-y-4 p-6 text-center">
        <p>
          {error ||
            (state === 'uploading'
              ? '원본을 업로드하고 있어요'
              : '최신 편집 내용을 저장하고 있어요')}
        </p>
        {error ? (
          <>
            {state !== 'conflict' && (
              <button
                className="rounded bg-rose-500 px-4 py-2"
                onClick={onRetry}
              >
                다시 시도
              </button>
            )}
            <button className="block w-full p-2" onClick={onBack}>
              편집으로 돌아가기
            </button>
          </>
        ) : (
          <p className="text-sm text-white/60">
            준비가 끝나면 자동으로 영상을 제작합니다.
          </p>
        )}
      </div>
    </div>
  );
}
