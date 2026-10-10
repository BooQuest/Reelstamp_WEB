export default function ProcessingView({ delayed = false, onExit }: { delayed?: boolean; onExit?: () => void }) {
  return (
    <div className="min-h-[100dvh] bg-black text-white flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="w-24 h-24 rounded-full border-4 border-white/10 border-t-[#FF4D6D] animate-spin mx-auto" />
        <div>
          <h1 className="text-2xl font-bold mb-2">릴스를 만들고 있어요</h1>
          <p className="text-sm text-white/60">
            {delayed ? '처리가 지연되고 있습니다. 프로젝트는 처리 중 탭에 보관되며, 완료되면 제작 완료 탭에서 확인할 수 있습니다.' : '곧 완성됩니다. 잠시만 기다려주세요!'}
          </p>
        </div>
        {onExit && <button type="button" onClick={onExit} className="rounded-full bg-[#FF4D6D] px-5 py-3 text-sm font-semibold">내 프로젝트로 이동</button>}
      </div>
    </div>
  );
}
