const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

export const isReelstampBetaEnabled = () =>
  TRUE_VALUES.has(
    (process.env.NEXT_PUBLIC_REELSTAMP_BETA_ENABLED ?? '').trim().toLowerCase()
  );
