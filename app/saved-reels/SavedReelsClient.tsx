'use client';

import { useRouter } from 'next/navigation';
import { Bookmark, Play } from 'lucide-react';
import { useSavedTemplates } from '@/app/hooks/useSavedTemplates';
import TemplateMediaPreview from '@/app/components/ui/TemplateMediaPreview';

const buildReelsMakerHref = (templateId: string) =>
  `/reels-maker?templateId=${encodeURIComponent(templateId)}&returnUrl=${encodeURIComponent('/saved-reels')}`;

export default function SavedReelsClient() {
  const router = useRouter();
  const { savedTemplates, isLoading, error, toggleSave } = useSavedTemplates({
    returnUrl: '/saved-reels',
  });

  const handleOpen = (templateId: string) => {
    router.push(`/all-templates?templateId=${templateId}`);
  };

  const handleCreate = (templateId: string) => {
    router.push(buildReelsMakerHref(templateId));
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
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
      {savedTemplates.map((template) => (
        <div key={template.id} className="group">
          <button
            type="button"
            onClick={() => handleOpen(template.id)}
            className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden bg-white shadow-sm ring-1 ring-black/5"
          >
            <TemplateMediaPreview
              title={template.title}
              thumbnailUrl={template.thumbnailUrl}
              embedUrl={template.embedUrl}
              disableEmbedInteraction
              imageClassName="transition-transform duration-300 group-hover:scale-[1.03]"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/70 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <Play className="w-5 h-5 text-white" />
              </div>
            </div>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                toggleSave(template);
              }}
              aria-pressed
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/70 text-[#FF4D6D] flex items-center justify-center shadow"
            >
              <Bookmark className="w-4 h-4" fill="#FF4D6D" />
            </button>
          </button>
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                {template.title}
              </h3>
              <p className="text-xs text-gray-500 line-clamp-1">{template.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => handleCreate(template.id)}
              className="shrink-0 px-3 py-2 text-xs font-semibold rounded-full bg-[#FF4D6D] text-white hover:bg-[#FF5F7A] transition-colors"
            >
              3분 만에 만들기
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
