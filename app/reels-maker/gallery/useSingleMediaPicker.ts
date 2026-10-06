'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { MediaTarget } from './types';

export default function useSingleMediaPicker(
  sessionId: number,
  onSelect: (file: File, target: MediaTarget) => Promise<void>,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<MediaTarget | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      targetRef.current = null;
    },
    [sessionId],
  );

  useEffect(() => {
    const input = inputRef.current;
    const cancel = () => {
      targetRef.current = null;
    };
    input?.addEventListener('cancel', cancel);
    return () => input?.removeEventListener('cancel', cancel);
  }, []);
  const open = (target: MediaTarget) => {
    const input = inputRef.current;
    if (!input || target.sessionId !== sessionId) return;
    targetRef.current = { ...target };
    setError(null);
    // Reset before opening so choosing the same file still emits change.
    input.value = '';
    try {
      // Must run synchronously in the user's click, including guide actions.
      input.click();
    } catch {
      targetRef.current = null;
      setError('사진·영상 선택창을 열지 못했습니다. 다시 눌러 주세요.');
    }
  };

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';
    const target = targetRef.current;
    targetRef.current = null;
    if (!files.length || !target || target.sessionId !== sessionId) return;
    if (
      files.length !== 1 ||
      files[0].size === 0 ||
      !/^(image|video)\//.test(files[0].type)
    ) {
      setError('읽을 수 있는 사진 또는 영상 한 개를 선택해 주세요.');
      return;
    }
    setError(null);
    void onSelect(files[0], target);
  };

  return { inputRef, open, onChange, error };
}
