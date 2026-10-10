import type { WebApiResponse } from '@/app/lib/api/auth';

export type DraftProjectItem = {
  sessionId: number;
  templateId: string;
  templateTitle?: string | null;
  templateThumbnailUrl?: string | null;
  projectThumbnailUrl?: string | null;
  projectThumbnailContentType?: string | null;
  projectThumbnailEdit?: import('../reels-maker/gallery/types').MediaEdit | null;
  projectName?: string | null;
  status: string;
  displayStatus?: 'CAPTURE' | 'PROCESSING' | 'COMPLETED';
  errorMessage?: string | null;
  mediaError?: string | null;
  finalVideoUrl?: string | null;
  completedClipCount: number;
  totalClipCount: number;
  lastEditedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
};

export type DraftProjectList = {
  reels: DraftProjectItem[];
  totalCount: number;
};

export type DraftProjectListResponse = WebApiResponse<DraftProjectList>;
