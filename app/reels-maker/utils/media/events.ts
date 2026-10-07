export function assertMediaActive(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Media operation cancelled', 'AbortError');
}

/** Wait for a browser media event without leaving listeners behind on cancellation. */
export function waitForMediaEvent(
  target: EventTarget,
  event: string,
  errorMessage: string,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      target.removeEventListener(event, onReady);
      target.removeEventListener('error', onError);
      signal?.removeEventListener('abort', onAbort);
    };
    const onReady = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error(errorMessage)); };
    const onAbort = () => { cleanup(); reject(new DOMException('Media operation cancelled', 'AbortError')); };
    if (signal?.aborted) { onAbort(); return; }
    target.addEventListener(event, onReady, { once: true });
    target.addEventListener('error', onError, { once: true });
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
