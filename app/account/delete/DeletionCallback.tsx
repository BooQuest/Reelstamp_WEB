'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUiText } from '@/app/i18n/LocaleProvider';
import { acceptDeletionCallback } from '@/app/lib/account-deletion/browser';

export default function DeletionCallback() {
  const router = useRouter();
  const t = useUiText();
  const handled = useRef(false);
  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const params = new URLSearchParams(window.location.search);
    // Remove code and provider error descriptions before any further navigation.
    window.history.replaceState({}, '', '/login');
    const accepted = acceptDeletionCallback(params);
    router.replace(accepted ? '/account/delete' : '/account/delete?reauthError=1');
  }, [router]);
  return <p role="status" className="mx-auto max-w-lg px-6 py-20">{t('본인 확인 결과를 처리하고 있습니다...')}</p>;
}
