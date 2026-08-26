export type AppToastTone = 'default' | 'error';

export type AppToastPayload = {
  message: string;
  tone?: AppToastTone;
  durationMs?: number;
};

export const APP_TOAST_EVENT = 'reelstamp:app-toast';

export const showAppToast = (payload: AppToastPayload) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<AppToastPayload>(APP_TOAST_EVENT, {
      detail: payload,
    })
  );
};
