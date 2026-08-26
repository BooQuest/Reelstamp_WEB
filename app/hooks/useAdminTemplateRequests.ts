'use client';

import { useQuery } from '@tanstack/react-query';

export type AdminTemplateRequestStatus = 'AVAILABLE' | 'REQUESTABLE' | 'COMING_SOON';

export interface AdminTemplateRequest {
  trendReelId: string;
  templateId: string | null;
  title: string;
  subtitle: string | null;
  status: AdminTemplateRequestStatus;
  requestCount: number;
  latestRequestedAt: string | null;
}

interface AdminTemplateRequestsResponse {
  success: boolean;
  status: number;
  message: string;
  errorCode: string | null;
  data: {
    requests: AdminTemplateRequest[];
    totalCount: number;
  } | null;
}

async function fetchAdminTemplateRequests(): Promise<AdminTemplateRequestsResponse> {
  const res = await fetch('/api/admin/template-requests', {
    method: 'GET',
  });

  const json = (await res.json()) as AdminTemplateRequestsResponse;

  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message || '템플릿 요청 현황을 가져오는 데 실패했습니다.');
  }

  return json;
}

export function useAdminTemplateRequests(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['admin', 'template-requests'],
    queryFn: fetchAdminTemplateRequests,
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled !== false,
  });
}
