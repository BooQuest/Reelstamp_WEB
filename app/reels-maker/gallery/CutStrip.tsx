import { Check } from 'lucide-react';
import type { MakerCut, ClipInfo } from '../types';
type Props = {
  cuts: MakerCut[];
  clips: Array<ClipInfo | null>;
  activeCutIndex: number;
  disabled: boolean;
  busy: boolean;
  errors: Record<number, string>;
  onSelect: (index: number) => void;
};
export default function CutStrip({
  cuts,
  clips,
  activeCutIndex,
  disabled,
  busy,
  errors,
  onSelect,
}: Props) {
  return (
    <div className="flex shrink-0 gap-2 overflow-x-auto px-3 py-2">
      {cuts.map((item, index) => (
        <button
          type="button"
          key={item.id}
          aria-label={`${index + 1}번 컷 선택`}
          aria-current={index === activeCutIndex}
          disabled={disabled}
          onClick={() => onSelect(index)}
          className={`relative aspect-[3/4] w-14 shrink-0 overflow-hidden rounded-lg border-2 ${index === activeCutIndex ? 'border-rose-500' : 'border-white/20'}`}
        >
          {clips[index] && (
            <video
              src={clips[index]!.url}
              muted
              playsInline
              preload="metadata"
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <span className="absolute left-1 top-1 rounded bg-black/50 px-1 text-[10px]">
            {index + 1}
          </span>
          {busy && index === activeCutIndex ? (
            <span className="absolute inset-x-0 top-6 text-[9px]">
              처리 중…
            </span>
          ) : errors[index] ? (
            <span
              className="absolute right-1 top-1 text-rose-400"
              aria-label="고정 컷 오류"
            >
              !
            </span>
          ) : (
            clips[index] && (
              <Check
                size={14}
                className="absolute right-1 top-1 rounded-full bg-emerald-500"
              />
            )
          )}
          <span className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-[10px]">
            {Number(
              (clips[index]?.duration ?? item.durationSeconds).toFixed(1),
            )}
            s
          </span>
        </button>
      ))}
    </div>
  );
}
