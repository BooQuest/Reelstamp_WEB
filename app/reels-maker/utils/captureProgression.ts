export type CaptureProgressCut = {
  isFixed?: boolean;
};

type FindNextIncompleteCaptureCutIndexArgs = {
  cuts: CaptureProgressCut[];
  uploadedCuts: Record<number, boolean | undefined>;
  fromIndex: number;
  completedCutIndex?: number | null;
};

export const findNextIncompleteCaptureCutIndex = ({
  cuts,
  uploadedCuts,
  fromIndex,
  completedCutIndex = null,
}: FindNextIncompleteCaptureCutIndexArgs): number => {
  const isIncompleteCaptureCut = (cut: CaptureProgressCut, index: number) =>
    !cut.isFixed && index !== completedCutIndex && !uploadedCuts[index];

  const nextAfterCurrent = cuts.findIndex(
    (cut, index) => index > fromIndex && isIncompleteCaptureCut(cut, index)
  );
  if (nextAfterCurrent >= 0) return nextAfterCurrent;

  return cuts.findIndex(isIncompleteCaptureCut);
};
