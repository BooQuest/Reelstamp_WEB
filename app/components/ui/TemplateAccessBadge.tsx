'use client';

import { Crown } from 'lucide-react';
import { clsx } from '@/app/lib/utils/clsx';
import type { TemplateAccessType } from '@/app/lib/templates/access';

type TemplateAccessBadgeProps = {
  accessType: TemplateAccessType;
  className?: string;
};

export default function TemplateAccessBadge({
  accessType,
  className,
}: TemplateAccessBadgeProps) {
  if (accessType !== 'PAID') {
    return null;
  }

  return (
    <span
      aria-label="유료 템플릿"
      title="유료 템플릿"
      className={clsx(
        'inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#F5C451] text-[#2A1A00] shadow-lg ring-1 ring-black/10 backdrop-blur',
        className
      )}
    >
      <Crown className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
    </span>
  );
}
