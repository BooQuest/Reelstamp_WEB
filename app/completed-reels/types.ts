import type { WebApiResponse } from '@/app/lib/api/auth';

export type CompletedReelItem = {
  sessionId: number;
  templateId: string;
  templateTitle?: string | null;
  templateThumbnailUrl?: string | null;
  status: string;
  finalVideoUrl?: string | null;
  createdAt: string;
};

export type CompletedReelsList = {
  reels: CompletedReelItem[];
  totalCount: number;
};

export type CompletedReelsResponse = WebApiResponse<CompletedReelsList>;

export type ReelDeleteBatchResult = {
  sessionId: number;
  success: boolean;
  message?: string;
  errorCode?: string | null;
};

export type ReelDeleteBatchData = {
  results: ReelDeleteBatchResult[];
};

export type ReelDeleteBatchResponse = WebApiResponse<ReelDeleteBatchData>;
