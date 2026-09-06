export function formatDurationSeconds(
  seconds: number | null | undefined,
  maxFractionDigits = 3
) {
  const value = Number(seconds ?? 0);
  if (!Number.isFinite(value)) {
    return '0';
  }

  const rounded = Number(value.toFixed(maxFractionDigits));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

export function formatDurationSecondsLabel(seconds: number | null | undefined) {
  return `${formatDurationSeconds(seconds)}초`;
}
