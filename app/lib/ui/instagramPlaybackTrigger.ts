export const INSTAGRAM_PLAYBACK_TRIGGER_ATTRIBUTE =
  'data-instagram-playback-trigger';

export const INSTAGRAM_PLAYBACK_TRIGGER_SELECTOR = `[${INSTAGRAM_PLAYBACK_TRIGGER_ATTRIBUTE}="true"]`;

export const isInstagramPlaybackTriggerTarget = (target: EventTarget | null) =>
  target instanceof Element &&
  target.closest(INSTAGRAM_PLAYBACK_TRIGGER_SELECTOR) !== null;
