'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/components/providers/AuthProvider';
import type { TemplateSummary } from './useSavedTemplates';
import {
  buildTemplateLoginHref,
  canUseTemplate,
  isComingSoonTemplate,
  isGuestTemplateUser,
  isPaidTemplate,
  resolveRestrictedTemplateLoginReturnUrl,
  shouldWaitForPaidTemplateSubscription,
  TEMPLATE_LOGIN_REQUIRED_MESSAGE,
  TEMPLATE_NOT_AVAILABLE_MESSAGE,
  TEMPLATE_PAYMENT_PATH,
} from '@/app/lib/templates/access';
import { showAppToast } from '@/app/lib/ui/toast';

export function useTemplateCreation(returnUrl: string) {
  const router = useRouter();
  const { isAuthenticated, user, subscription, isLoadingSubscription } = useAuth();
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [accessMessage, setAccessMessage] = useState<string | null>(null);

  useEffect(() => () => {
    if (redirectTimer.current) clearTimeout(redirectTimer.current);
  }, []);

  const isAccessLoading = (template: TemplateSummary) =>
    shouldWaitForPaidTemplateSubscription({ template, isAuthenticated, user, isLoadingSubscription });

  const create = (template: TemplateSummary) => {
    if (redirectTimer.current) clearTimeout(redirectTimer.current);
    setAccessMessage(null);
    if (isComingSoonTemplate(template)) {
      setAccessMessage(TEMPLATE_NOT_AVAILABLE_MESSAGE);
      showAppToast({ message: TEMPLATE_NOT_AVAILABLE_MESSAGE, tone: 'error' });
      return;
    }
    if (isAccessLoading(template)) return;

    const destination = `/reels-maker?templateId=${encodeURIComponent(template.id)}&returnUrl=${encodeURIComponent(returnUrl)}`;
    if (isPaidTemplate(template) && !canUseTemplate({ template, isAuthenticated, user, subscription })) {
      if (!isAuthenticated || isGuestTemplateUser(user)) {
        setAccessMessage(TEMPLATE_LOGIN_REQUIRED_MESSAGE);
        showAppToast({ message: TEMPLATE_LOGIN_REQUIRED_MESSAGE, tone: 'error' });
        redirectTimer.current = setTimeout(() => {
          router.push(buildTemplateLoginHref(resolveRestrictedTemplateLoginReturnUrl(destination)));
        }, 800);
      } else {
        router.push(TEMPLATE_PAYMENT_PATH);
      }
      return;
    }

    router.push(isAuthenticated ? destination : buildTemplateLoginHref(destination));
  };

  return { create, isAccessLoading, accessMessage };
}
