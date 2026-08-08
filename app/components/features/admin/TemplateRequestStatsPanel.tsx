'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Calendar, FileQuestion, Loader2, RefreshCw, Search, X } from 'lucide-react';
import {
  AdminTemplateRequest,
  AdminTemplateRequestStatus,
  useAdminTemplateRequests,
} from '@/app/hooks/useAdminTemplateRequests';

const REQUESTABLE_STATUS: AdminTemplateRequestStatus = 'REQUESTABLE';

const formatDateTime = (value: string | null) => {
  if (!value) {
    return '요청 없음';
  }

  return new Date(value).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function TemplateRequestStatsPanel({ enabled = true }: { enabled?: boolean }) {
  const { data, isLoading, error, refetch } = useAdminTemplateRequests({ enabled });
  const [searchKeyword, setSearchKeyword] = useState('');

  const requests = useMemo(
    () => (data?.data?.requests ?? []).filter((item) => item.status === REQUESTABLE_STATUS),
    [data],
  );
  const filteredRequests = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) {
      return requests;
    }

    return requests.filter((item) => {
      const haystack = [
        item.trendReelId,
        item.templateId,
        item.title,
        item.subtitle,
        item.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [requests, searchKeyword]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-[#FF496D]" />
          <p className="text-gray-400 font-bold animate-pulse">템플릿 요청 현황을 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-[40px] p-16 shadow-2xl border border-red-50 text-center">
        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-[30px] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-100">
          <X className="w-10 h-10" />
        </div>
        <p className="text-2xl font-black text-gray-900 mb-2">템플릿 요청 현황을 불러오지 못했습니다.</p>
        <p className="text-gray-500 mb-8 font-medium">네트워크 상태를 확인하거나 잠시 후 다시 시도해 주세요.</p>
        <button
          onClick={() => refetch()}
          className="px-8 py-3.5 rounded-2xl bg-gray-900 text-white text-base font-black hover:bg-gray-800 transition-all shadow-xl active:scale-95"
        >
          다시 시도하기
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="bg-white/80 backdrop-blur-2xl rounded-[40px] shadow-2xl shadow-pink-500/5 border border-white p-8 flex flex-col gap-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Template Requests</p>
            <h2 className="text-2xl font-black text-gray-900">템플릿 요청 현황</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              className="p-3 bg-white hover:bg-gray-50 text-gray-400 hover:text-gray-600 rounded-2xl border border-gray-100 shadow-sm transition-all active:scale-95"
              title="새로고침"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <div className="bg-white px-5 py-3 rounded-2xl border border-pink-100 shadow-sm">
              <span className="text-sm font-black text-gray-700">
                전체 {requests.length}건 (표시: {filteredRequests.length}건)
              </span>
            </div>
          </div>
        </div>

        <div className="relative group">
          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#FF496D] transition-all group-focus-within:scale-110">
            <Search className="w-6 h-6" />
          </div>
          <input
            type="text"
            value={searchKeyword}
            onChange={(event) => setSearchKeyword(event.target.value)}
            placeholder="릴스 ID, 제목, 설명으로 검색하세요..."
            className="w-full h-16 pl-14 pr-8 rounded-[25px] border border-transparent bg-gray-50 text-base font-bold text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-[#FF496D] focus:ring-4 focus:ring-pink-100 transition-all shadow-sm"
          />
        </div>
      </div>

      {requests.length === 0 && (
        <div className="bg-white rounded-[40px] p-24 shadow-sm text-center border border-gray-100">
          <div className="w-24 h-24 bg-gray-50 text-gray-200 rounded-[35px] flex items-center justify-center mx-auto mb-8">
            <FileQuestion className="w-12 h-12" />
          </div>
          <p className="text-2xl font-black text-gray-900 mb-3">아직 등록된 트렌드 카드가 없습니다.</p>
          <p className="text-gray-400 font-bold">요청 가능한 오늘의 릴스 트렌드 카드가 등록되면 이곳에서 확인하실 수 있습니다.</p>
        </div>
      )}

      {requests.length > 0 && filteredRequests.length === 0 && (
        <div className="bg-white rounded-[40px] p-20 shadow-sm text-center border border-gray-100">
          <p className="text-2xl font-black text-gray-900 mb-6">검색 결과가 없습니다.</p>
          <button
            onClick={() => setSearchKeyword('')}
            className="px-8 py-3 rounded-2xl bg-pink-50 text-[#FF496D] text-base font-black hover:bg-[#FF496D] hover:text-white transition-all active:scale-95"
          >
            검색 초기화
          </button>
        </div>
      )}

      {filteredRequests.length > 0 && (
        <div className="overflow-x-auto pb-10 custom-scrollbar-horizontal -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
          <div className="space-y-5 min-w-[980px]">
            {filteredRequests.map((item) => (
              <TemplateRequestRow key={item.trendReelId} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TemplateRequestRow({ item }: { item: AdminTemplateRequest }) {
  return (
    <article className="bg-white rounded-[34px] shadow-sm border border-gray-100 overflow-hidden hover:shadow-2xl hover:shadow-pink-500/10 transition-all duration-500">
      <div className="h-1.5 bg-gradient-to-r from-[#FF496D] to-orange-400" />
      <div className="px-8 py-7 flex items-center gap-8">
        <div className="w-16 h-16 rounded-[24px] bg-gradient-to-br from-[#FF496D] to-[#FF8E9E] flex items-center justify-center text-2xl font-black text-white shadow-xl shadow-pink-100 flex-shrink-0">
          {item.requestCount}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-black text-gray-900 truncate">{item.title}</h3>
            <span className="px-3 py-1 rounded-xl text-[10px] font-black border uppercase tracking-widest bg-pink-50 text-[#FF496D] border-pink-100">
              요청 가능
            </span>
          </div>
          <p className="text-sm font-bold text-gray-500 line-clamp-1">
            {item.subtitle || '부제 없음'}
          </p>
          <div className="flex items-center gap-3 mt-3 text-xs font-black text-gray-400">
            <span>{item.trendReelId}</span>
            {item.templateId && (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-gray-200" />
                <span>템플릿 {item.templateId}</span>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 flex-shrink-0 min-w-[300px]">
          <Metric label="요청 수" value={`${item.requestCount}건`} />
          <Metric label="최근 요청" value={formatDateTime(item.latestRequestedAt)} icon={<Calendar className="w-4 h-4" />} />
        </div>
      </div>
    </article>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="bg-gray-50 rounded-[22px] px-5 py-4 border border-gray-100">
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">{label}</p>
      <div className="flex items-center gap-2 text-gray-900">
        {icon}
        <p className="text-sm font-black truncate">{value}</p>
      </div>
    </div>
  );
}
