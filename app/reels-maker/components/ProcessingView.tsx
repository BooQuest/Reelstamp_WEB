export default function ProcessingView() {
  return (
    <div className="min-h-[100dvh] bg-black text-white flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="w-24 h-24 rounded-full border-4 border-white/10 border-t-[#FF4D6D] animate-spin mx-auto" />
        <div>
          <h1 className="text-2xl font-bold mb-2">릴스를 만들고 있어요</h1>
          <p className="text-sm text-white/60">
            곧 완성됩니다. 잠시만 기다려주세요!
          </p>
        </div>
      </div>
    </div>
  );
}
