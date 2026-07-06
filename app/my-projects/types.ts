import type { WebApiResponse } from '@/app/lib/api/auth';

export type DraftProjectItem = {
  sessionId: number;
  templateId: string;
  templateTitle?: string | null;
  templateThumbnailUrl?: string | null;
  projectName?: string | null;
  status: string;
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
