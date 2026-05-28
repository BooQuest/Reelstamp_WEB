'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  Circle,
  Filter,
  Loader2,
  Trash2,
  X,
} from 'lucide-react';
import type { CompletedReelItem, ReelDeleteBatchResponse } from '@/app/completed-reels/types';

type CompletedReelActionsProps = {
  initialReels: CompletedReelItem[];
  loadError: string | null;
};

const MAX_BATCH_DELETE = 100;

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}

function toUniqueNumberArray(values: number[]): number[] {
  return Array.from(new Set(values));
}

export default function CompletedReelActions({
  initialReels,
  loadError,
}: CompletedReelActionsProps) {
  const [reels, setReels] = useState<CompletedReelItem[]>(initialReels);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<number[]>([]);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [failedDeleteMessages, setFailedDeleteMessages] = useState<Record<number, string>>({});
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [confirmSessionIds, setConfirmSessionIds] = useState<number[] | null>(null);

  const reelIdSet = useMemo(() => new Set(reels.map((reel) => reel.sessionId)), [reels]);
  const selectedIdSet = useMemo(() => new Set(selectedSessionIds), [selectedSessionIds]);

  const failedIdsInList = useMemo(
    () => reels.filter((reel) => failedDeleteMessages[reel.sessionId]).map((reel) => reel.sessionId),
    [failedDeleteMessages, reels]
  );

  const totalCount = reels.length;
  const selectedCount = selectedSessionIds.length;
  const allSelected = totalCount > 0 && selectedCount === totalCount;
  const canDeleteSelected = selectedCount > 0 && !isBatchDeleting;

  const closeSelectionMode = () => {
    setSelectionMode(false);
    setSelectedSessionIds([]);
  };

  const toggleSelectionMode = () => {
    if (selectionMode) {
      closeSelectionMode();
      setNoticeMessage(null);
      return;
    }
    setSelectionMode(true);
    setNoticeMessage(null);
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedSessionIds([]);
      return;
    }
    setSelectedSessionIds(reels.map((reel) => reel.sessionId));
  };

  const toggleSelectOne = (sessionId: number) => {
    setSelectedSessionIds((prev) => {
      if (prev.includes(sessionId)) {
        return prev.filter((id) => id !== sessionId);
      }
      return [...prev, sessionId];
    });
  };

  const removeDeletedFromFailedMap = (deletedIds: Set<number>) => {
    setFailedDeleteMessages((prev) => {
      const next = { ...prev };
      deletedIds.forEach((id) => {
        delete next[id];
      });
      return next;
    });
  };

  const openBatchDeleteConfirm = (sessionIds: number[]) => {
    const uniqueIds = toUniqueNumberArray(sessionIds).filter((id) => reelIdSet.has(id));
    if (uniqueIds.length === 0 || isBatchDeleting) return;

    setNoticeMessage(null);
    setConfirmSessionIds(uniqueIds);
  };

  const deleteBatch = async (sessionIds: number[]) => {
    const uniqueIds = toUniqueNumberArray(sessionIds).filter((id) => reelIdSet.has(id));
    if (uniqueIds.length === 0) return;

    if (uniqueIds.length > MAX_BATCH_DELETE) {
      setNoticeMessage(`한 번에 최대 ${MAX_BATCH_DELETE}개까지 삭제할 수 있습니다.`);
      return;
    }

    setIsBatchDeleting(true);
    setFailedDeleteMessages((prev) => {
      const next = { ...prev };
      uniqueIds.forEach((id) => {
        delete next[id];
      });
      return next;
    });

    try {
      const response = await fetch('/api/reels-maker/sessions/delete-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionIds: uniqueIds }),
      });

      const payload: ReelDeleteBatchResponse = await response.json().catch(() => ({
        success: false,
        status: response.status,
        message: '삭제 응답을 확인하지 못했습니다.',
        data: { results: [] },
      }));

      const resultMap = new Map<number, { success: boolean; message?: string }>();

      if (Array.isArray(payload?.data?.results) && payload.data.results.length > 0) {
        payload.data.results.forEach((result) => {
          resultMap.set(result.sessionId, {
            success: Boolean(result.success),
            message: result.message,
          });
        });
      } else if (response.ok && payload?.success) {
        uniqueIds.forEach((id) => {
          resultMap.set(id, { success: true });
        });
      }

      const succeededIds: number[] = [];
      const failedIds: Array<{ id: number; message: string }> = [];

      uniqueIds.forEach((id) => {
        const result = resultMap.get(id);
        if (result?.success) {
          succeededIds.push(id);
        } else {
          failedIds.push({
            id,
            message: result?.message || payload?.message || '릴스 삭제에 실패했습니다.',
          });
        }
      });

      if (succeededIds.length > 0) {
        const succeededSet = new Set(succeededIds);
        setReels((prev) => prev.filter((reel) => !succeededSet.has(reel.sessionId)));
        setSelectedSessionIds((prev) => prev.filter((id) => !succeededSet.has(id)));
        removeDeletedFromFailedMap(succeededSet);
      }

      if (failedIds.length > 0) {
        setFailedDeleteMessages((prev) => {
          const next = { ...prev };
          failedIds.forEach(({ id, message }) => {
            next[id] = message;
          });
          return next;
        });
      }

      if (failedIds.length === 0) {
        setNoticeMessage(`릴스 ${succeededIds.length}개를 삭제했습니다.`);
      } else if (succeededIds.length === 0) {
        setNoticeMessage('선택한 릴스를 삭제하지 못했습니다. 다시 시도해주세요.');
      } else {
        setNoticeMessage(
          `릴스 ${succeededIds.length}개 삭제, ${failedIds.length}개 실패했습니다. 실패 항목을 다시 시도해주세요.`
        );
      }
    } catch {
      setFailedDeleteMessages((prev) => {
        const next = { ...prev };
        uniqueIds.forEach((id) => {
          next[id] = '릴스 삭제에 실패했습니다.';
        });
        return next;
      });
      setNoticeMessage('선택한 릴스를 삭제하지 못했습니다. 다시 시도해주세요.');
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!confirmSessionIds) return;
    const targetIds = [...confirmSessionIds];
    setConfirmSessionIds(null);
    await deleteBatch(targetIds);
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0C111B] text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-10">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">제작 완료된 릴스</h1>
            <p className="text-sm text-white/60 mt-2">지금까지 제작한 릴스를 한눈에 확인하세요.</p>
          </div>
          <div className="text-sm text-white/60">총 {totalCount}개</div>
        </div>

        {noticeMessage && !loadError && (
          <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
            {noticeMessage}
          </div>
        )}

        {loadError && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
            {loadError}
          </div>
        )}

        {!loadError && totalCount === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-sm text-white/70">
            아직 제작 완료된 릴스가 없습니다.
          </div>
        )}

        {!loadError && totalCount > 0 && (
          <>
            <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
              <div className="h-10 flex items-center justify-between gap-3">
                {!selectionMode ? (
                  <>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled
                        aria-disabled="true"
                        className="inline-flex h-10 items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold text-white/45 transition hover:bg-white/5"
                        title="정렬 기능 준비 중"
                      >
                        <ArrowUpDown className="h-3.5 w-3.5" />
                        <span>정렬</span>
                      </button>
                      <button
                        type="button"
                        disabled
                        aria-disabled="true"
                        className="inline-flex h-10 items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold text-white/45 transition hover:bg-white/5"
                        title="필터 기능 준비 중"
                      >
                        <Filter className="h-3.5 w-3.5" />
                        <span>필터</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={toggleSelectionMode}
                      disabled={isBatchDeleting}
                      className="inline-flex h-10 items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/10 disabled:opacity-50"
                      title="선택 모드 켜기"
                    >
                      <Circle className="h-4 w-4" />
                      <span>선택</span>
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={closeSelectionMode}
                        disabled={isBatchDeleting}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 disabled:opacity-50"
                        aria-label="선택 닫기"
                        title="선택 닫기"
                      >
                        <X className="h-4 w-4" />
                      </button>

                      <span className="text-sm font-semibold text-white/90">{selectedCount}개 선택</span>

                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        disabled={isBatchDeleting}
                        className="inline-flex h-9 items-center rounded-full px-3 py-1.5 text-xs font-semibold text-white/90 transition hover:bg-white/10 disabled:opacity-50"
                      >
                        {allSelected ? '전체 해제' : '전체 선택'}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => openBatchDeleteConfirm(selectedSessionIds)}
                      disabled={!canDeleteSelected}
                      className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#8B2635] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#6B1A25] disabled:opacity-50"
                    >
                      {isBatchDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      <span>{isBatchDeleting ? '삭제 중' : '삭제'}</span>
                    </button>
                  </>
                )}
              </div>

              {selectionMode && failedIdsInList.length > 0 && (
                <div className="mt-3 flex">
                  <button
                    type="button"
                    onClick={() => openBatchDeleteConfirm(failedIdsInList)}
                    disabled={isBatchDeleting}
                    className="rounded-full border border-[#8B2635] bg-[#8B2635]/20 px-4 py-2 text-xs font-semibold text-[#F7C6CF] hover:bg-[#8B2635]/30 disabled:opacity-50"
                  >
                    실패 항목 다시 시도 ({failedIdsInList.length})
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {reels.map((reel) => {
                const isChecked = selectedIdSet.has(reel.sessionId);
                const failureMessage = failedDeleteMessages[reel.sessionId];

                return (
                  <div
                    key={reel.sessionId}
                    onClick={() => {
                      if (!selectionMode || isBatchDeleting) return;
                      toggleSelectOne(reel.sessionId);
                    }}
                    className={`rounded-3xl border bg-white/5 overflow-hidden shadow-lg transition ${
                      selectionMode
                        ? isChecked
                          ? 'cursor-pointer border-[#FF4D6D]/70 ring-1 ring-[#FF4D6D]/60'
                          : 'cursor-pointer border-white/10 hover:border-white/25'
                        : 'border-white/10'
                    }`}
                  >
                    <div className="relative w-full aspect-[3/4] bg-black">
                      {selectionMode && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleSelectOne(reel.sessionId);
                          }}
                          disabled={isBatchDeleting}
                          className={`absolute left-3 top-3 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
                            isChecked
                              ? 'border-[#FF4D6D] bg-[#FF4D6D] text-white shadow-md'
                              : 'border-white/50 bg-black/45 text-white/90 hover:bg-black/60'
                          } disabled:opacity-50`}
                          aria-label={isChecked ? '선택 해제' : '선택'}
                          title={isChecked ? '선택 해제' : '선택'}
                        >
                          {isChecked ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                        </button>
                      )}

                      {reel.templateThumbnailUrl ? (
                        <Image
                          src={reel.templateThumbnailUrl}
                          alt={reel.templateTitle || '릴스 썸네일'}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-white/40">
                          썸네일 없음
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                      <div className="absolute bottom-4 left-4 right-4">
                        <h3 className="text-base font-semibold truncate">{reel.templateTitle || '템플릿'}</h3>
                        <p className="text-xs text-white/70 mt-1">{formatDate(reel.createdAt)}</p>
                      </div>
                    </div>

                    <div className="p-4 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-white/60">상태: {reel.status}</span>
                        {reel.finalVideoUrl ? (
                          <a
                            href={reel.finalVideoUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => {
                              if (!selectionMode) return;
                              event.preventDefault();
                              event.stopPropagation();
                            }}
                            className={`rounded-full bg-[#FF4D6D] px-4 py-2 text-xs font-semibold ${
                              selectionMode ? 'pointer-events-none opacity-55' : ''
                            }`}
                          >
                            영상 보기
                          </a>
                        ) : (
                          <span className="text-xs text-white/40">영상 없음</span>
                        )}
                      </div>

                      {failureMessage && (
                        <div className="mt-3 rounded-xl border border-[#8B2635]/50 bg-[#8B2635]/20 px-3 py-2 text-xs text-[#F7C6CF]">
                          삭제 실패: {failureMessage}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {confirmSessionIds && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => {
              if (isBatchDeleting) return;
              setConfirmSessionIds(null);
            }}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/15 bg-[#121A2A] p-6 text-white shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-full bg-[#8B2635]/30 p-2">
                <AlertTriangle className="h-5 w-5 text-[#F7C6CF]" />
              </div>
              <h2 className="text-lg font-bold">삭제 확인</h2>
            </div>

            <p className="text-sm leading-6 text-white/80">
              {`선택한 ${confirmSessionIds.length}개의 릴스를 삭제합니다. 삭제 후 복구할 수 없습니다. 계속하시겠습니까?`}
            </p>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmSessionIds(null)}
                disabled={isBatchDeleting}
                className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/10 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isBatchDeleting}
                className="rounded-lg bg-[#8B2635] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6B1A25] disabled:opacity-50"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
