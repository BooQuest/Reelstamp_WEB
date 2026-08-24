'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bookmark, Play } from 'lucide-react';
import { useAuth } from '@/app/components/providers/AuthProvider';
import { useSavedTemplates, type TemplateSummary } from '@/app/hooks/useSavedTemplates';
import TemplateMediaPreview from '@/app/components/ui/TemplateMediaPreview';
import TemplateAccessBadge from '@/app/components/ui/TemplateAccessBadge';
import {
  buildTemplateLoginHref,
  canUseTemplate,
  isGuestTemplateUser,
  isPaidTemplate,
  resolveTemplateAccessType,
  resolveRestrictedTemplateLoginReturnUrl,
  shouldWaitForPaidTemplateSubscription,
  TEMPLATE_LOGIN_REQUIRED_MESSAGE,
  TEMPLATE_PAYMENT_PATH,
} from '@/app/lib/templates/access';
import { showAppToast } from '@/app/lib/ui/toast';

const buildReelsMakerHref = (templateId: string) =>
  `/reels-maker?templateId=${encodeURIComponent(templateId)}&returnUrl=${encodeURIComponent('/saved-reels')}`;

export default function SavedReelsClient() {
  const router = useRouter();
  const { isAuthenticated, user, subscription, isLoadingSubscription } = useAuth();
  const { savedTemplates, isLoading, error, toggleSave } = useSavedTemplates({
    returnUrl: '/saved-reels',
  });
  const accessRedirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (accessRedirectTimerRef.current) {
        clearTimeout(accessRedirectTimerRef.current);
      }
    };
  }, []);

  const isTemplateAccessLoading = (template: TemplateSummary) =>
    shouldWaitForPaidTemplateSubscription({
      template,
      isAuthenticated,
      user,
      isLoadingSubscription,
    });

  const redirectToTemplateLogin = (returnUrl?: string) => {
    showAppToast({
      message: TEMPLATE_LOGIN_REQUIRED_MESSAGE,
      tone: 'error',
    });
    if (accessRedirectTimerRef.current) {
      clearTimeout(accessRedirectTimerRef.current);
    }
    accessRedirectTimerRef.current = setTimeout(() => {
      router.push(buildTemplateLoginHref(returnUrl));
    }, 800);
  };

  const handleRestrictedPaidTemplate = (destination?: string) => {
    if (!isAuthenticated || isGuestTemplateUser(user)) {
      redirectToTemplateLogin(resolveRestrictedTemplateLoginReturnUrl(destination));
      return;
    }

    router.push(TEMPLATE_PAYMENT_PATH);
  };

  const ensureTemplateAccess = (template: TemplateSummary, destination?: string) => {
    if (!isPaidTemplate(template)) {
      return true;
    }
    if (isTemplateAccessLoading(template)) {
      return false;
    }
    if (canUseTemplate({ template, isAuthenticated, user, subscription })) {
      return true;
    }

    handleRestrictedPaidTemplate(destination);
    return false;
  };

  const handleOpen = (template: TemplateSummary) => {
    const destination = `/all-templates?templateId=${encodeURIComponent(template.id)}`;
    if (!ensureTemplateAccess(template, destination)) {
      return;
    }

    router.push(destination);
  };

  const handleCreate = (template: TemplateSummary) => {
    const destination = buildReelsMakerHref(template.id);
    if (!ensureTemplateAccess(template, destination)) {
      return;
    }

    router.push(destination);
  };

  if (isLoading) {
    return (
      <div className="py-16 text-center text-sm sm:text-base text-gray-500">
        저장된 릴스를 불러오는 중입니다...
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-16 text-center text-sm sm:text-base text-rose-500">
        {error}
      </div>
    );
  }

  if (savedTemplates.length === 0) {
    return (
      <div className="py-16 text-center text-sm sm:text-base text-gray-500">
        저장된 릴스가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
        {savedTemplates.map((template) => (
          <div key={template.id} className="group">
            <div className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden bg-white shadow-sm ring-1 ring-black/5">
              <button
                type="button"
                onClick={() => handleOpen(template)}
                className="relative block h-full w-full"
              >
                <TemplateAccessBadge
                  accessType={resolveTemplateAccessType(template)}
                  className="absolute left-2 top-2 z-10 sm:left-3 sm:top-3"
                />
                <TemplateMediaPreview
                  title={template.title}
                  thumbnailUrl={template.thumbnailUrl}
                  embedUrl={template.embedUrl}
                  instagramOnly={template.instagramOnly}
                  disableEmbedInteraction
                  imageClassName="transition-transform duration-300 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/70 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                    <Play className="w-5 h-5 text-white" />
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => toggleSave(template)}
                aria-pressed
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/70 text-[#FF4D6D] flex items-center justify-center shadow"
              >
                <Bookmark className="w-4 h-4" fill="#FF4D6D" />
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                  {template.title}
                </h3>
                <p className="text-xs text-gray-500 line-clamp-1">{template.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => handleCreate(template)}
                disabled={isTemplateAccessLoading(template)}
                className="shrink-0 px-3 py-2 text-xs font-semibold rounded-full bg-[#FF4D6D] text-white hover:bg-[#FF5F7A] transition-colors disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {isTemplateAccessLoading(template) ? '확인 중' : '3분 만에 만들기'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
