import Link from 'next/link';

type Props = {
  loginHref: string;
  onContinue: () => void;
};

export default function GuestDraftNotice({ loginHref, onContinue }: Props) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 px-4">
      <div className="w-full max-w-sm rounded-3xl bg-[#172235] p-6 text-white shadow-2xl">
        <h2 className="text-lg font-bold">게스트로 릴스를 제작합니다</h2>
        <p className="mt-3 text-sm leading-6 text-white/70">
          게스트는 프로젝트 중도 저장과 이어서 만들기를 이용할 수 없습니다.
          로그인하면 작업이 자동 저장되며 마지막 저장일로부터 30일 동안 보관됩니다.
        </p>
        <div className="mt-6 space-y-2">
          <Link
            href={loginHref}
            className="flex h-12 w-full items-center justify-center rounded-full bg-[#FF4D6D] text-sm font-semibold"
          >
            로그인하고 이어서 만들기
          </Link>
          <button
            type="button"
            onClick={onContinue}
            className="h-12 w-full rounded-full border border-white/20 text-sm font-semibold text-white/85"
          >
            저장 없이 계속하기
          </button>
        </div>
      </div>
    </div>
  );
}
