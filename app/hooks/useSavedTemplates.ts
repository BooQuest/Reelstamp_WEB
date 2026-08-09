'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/components/providers/AuthProvider';
import type { WebApiResponse } from '@/app/lib/api/auth';
import type { TemplateAccessType } from '@/app/lib/templates/access';

export type TemplateSummary = {
  id: string;
  title: string;
  subtitle: string;
  thumbnailUrl?: string | null;
  embedUrl?: string | null;
  tags: string[];
  accessType?: TemplateAccessType | null;
};

type TemplateListResponse = {
  templates: TemplateSummary[];
};

type TemplateSaveToggleResponse = {
  templateId: string;
  saved: boolean;
};

type UseSavedTemplatesOptions = {
  returnUrl?: string;
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export function useSavedTemplates(options: UseSavedTemplatesOptions = {}) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [savedTemplates, setSavedTemplates] = useState<TemplateSummary[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const savedSet = useMemo(() => new Set(savedIds), [savedIds]);
  const returnUrl = options.returnUrl ?? '/templates';

  const normalizeTemplates = (templates: TemplateSummary[]) =>
    templates.map((template) => ({
      ...template,
      subtitle: template.subtitle ?? '',
      thumbnailUrl: template.thumbnailUrl?.trim() || null,
      embedUrl: template.embedUrl ?? null,
      tags: Array.isArray(template.tags) ? template.tags : [],
    }));

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setSavedTemplates([]);
      setSavedIds([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/templates/saved', {
        method: 'GET',
        cache: 'no-store',
      });
      const payload: WebApiResponse<TemplateListResponse> = await response.json();

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || '저장된 템플릿을 불러오지 못했습니다.');
      }

      const templates = normalizeTemplates(payload.data?.templates ?? []);
      setSavedTemplates(templates);
      setSavedIds(templates.map((template) => template.id));
    } catch (err: unknown) {
      setError(getErrorMessage(err, '저장된 템플릿을 불러오지 못했습니다.'));
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggleSave = useCallback(
    async (template: TemplateSummary | { id: string }) => {
      if (!isAuthenticated) {
        router.push(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
        return;
      }

      try {
        setError(null);
        const templateId = template.id;
        const response = await fetch(`/api/templates/${encodeURIComponent(templateId)}/save`, {
          method: 'POST',
        });
        const payload: WebApiResponse<TemplateSaveToggleResponse> = await response.json();

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || '저장 처리에 실패했습니다.');
        }

        const saved = payload.data?.saved ?? false;
        if (saved) {
          if ('title' in template) {
            setSavedTemplates((prev) => {
              const exists = prev.some((item) => item.id === templateId);
              if (exists) return prev;
              return [
                {
                  ...template,
                  thumbnailUrl: template.thumbnailUrl?.trim() || null,
                  embedUrl: template.embedUrl ?? null,
                  tags: Array.isArray(template.tags) ? template.tags : [],
                } as TemplateSummary,
                ...prev,
              ];
            });
          } else {
            refresh();
          }
          setSavedIds((prev) => (prev.includes(templateId) ? prev : [templateId, ...prev]));
        } else {
          setSavedTemplates((prev) => prev.filter((item) => item.id !== templateId));
          setSavedIds((prev) => prev.filter((id) => id !== templateId));
        }
      } catch (err: unknown) {
        setError(getErrorMessage(err, '저장 처리에 실패했습니다.'));
      }
    },
    [isAuthenticated, refresh, returnUrl, router]
  );

  return {
    savedTemplates,
    savedIds,
    savedSet,
    isLoading,
    error,
    refresh,
    toggleSave,
  };
}
