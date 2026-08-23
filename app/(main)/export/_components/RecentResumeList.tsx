"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/client";
import { deleteResume, getResumeList } from "@/lib/api/export-api";
import { useBasePath } from "@/lib/utils/use-base-path";
import { formatDateTime, formatRelativeTime } from "@/lib/utils/date-utils";
import type { ResumeListItem } from "@/types/resume";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { ListRefreshErrorBanner } from "./ListRefreshErrorBanner";

interface RecentResumeListProps {
  onCreateClick: () => void;
  reloadToken?: number;
}

// 서버가 제목을 주지 않아 만든 시각을 이름으로 쓴다.
function resumeLabel(createdAt: string): string {
  if (!createdAt) return "레쥬메";
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "레쥬메";
  return `${formatDateTime(createdAt)} 레쥬메`;
}

export function RecentResumeList({
  onCreateClick,
  reloadToken = 0,
}: RecentResumeListProps) {
  const basePath = useBasePath();
  const [items, setItems] = useState<ResumeListItem[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // FRT-258 — 자기소개서 목록과 같은 창이다. 로딩 게이트가 `items === null`(첫 조회 전용)이라
  // `reloadToken` 재조회는 목록이 조작 가능한 채로 돌고, 그 사이의 삭제를 늦게 도착한 응답이
  // 덮는다. 여긴 폴링이 없어 교정할 다음 조회도 없다 — 되살아나면 새로고침 전까지 남는다.
  // 세대(seqRef)는 "더 새 요청이 이겼다"만 판정한다. 삭제는 요청을 만들지 않아 세대가
  // 안 오르므로 지운 id 를 따로 기억한다 — 그렇다고 삭제가 세대를 올려 응답을 **버리면**
  // `reloadToken` 이 실어 온 방금 만든 레쥬메까지 사라지고, 여긴 그걸 되살릴 폴링도 없다.
  const seqRef = useRef(0);
  const mountedRef = useRef(true);
  const deletedIdsRef = useRef<Set<string>>(new Set());

  // load 보다 앞에 선언한다 — 마운트 effect 순서상 이쪽이 먼저 true 를 세워야 한다.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const seq = ++seqRef.current;
    try {
      const data = await getResumeList();
      // 가드는 **쓰기보다 앞**이어야 한다. 언마운트됐거나 이 응답이 떠난 뒤 더 새 요청이
      // 시작됐으면 화면에 쓰지 않는다.
      if (!mountedRef.current || seq !== seqRef.current) return;
      setError(null);
      // 이 응답이 떠난 뒤 사용자가 지운 행은 서버가 아직 모를 수 있다 — 빼고 그린다.
      setItems(data.filter((r) => !deletedIdsRef.current.has(r.version_id)));
    } catch (err) {
      if (!mountedRef.current || seq !== seqRef.current) return;
      // FRT-319 — 실패를 "목록이 비었다"로 기록하지 않는다. 자기소개서 목록과 같은 결함인데
      // 여긴 더 나쁘다: 폴링이 없어 **되돌려 줄 다음 조회조차 없다**. 한 번 지워지면 사용자가
      // '다시 시도'를 직접 누르거나 새로고침할 때까지 빈 화면이 남는다.
      setError(err as Error);
    }
  }, []);

  // 집합 기록과 화면 제거를 한 몸으로 묶는다 — 둘 중 하나만 하면 그 순간 떠 있던
  // 재조회가 지운 행을 되살린다.
  const removeLocally = (versionId: string) => {
    deletedIdsRef.current.add(versionId);
    setItems((prev) => (prev ?? []).filter((r) => r.version_id !== versionId));
  };

  useEffect(() => {
    load();
  }, [load, reloadToken]);

  const handleDelete = async (versionId: string) => {
    setDeletingId(versionId);
    try {
      await deleteResume(versionId);
      removeLocally(versionId);
      toast.success("레쥬메를 삭제했어요");
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // 이미 없는 것을 지우려 한 것뿐이다 — 사용자가 원한 결과와 같으므로 목록에서 뺀다.
        removeLocally(versionId);
      } else {
        toast.error("삭제에 실패했어요");
      }
    } finally {
      setDeletingId(null);
      // 성공·실패·삭제 미지원(버튼 자체가 사라지는 경로) 어디로 빠져도 다이얼로그를 닫는다.
      setPendingDeleteId(null);
    }
  };

  // 첫 조회가 아직 안 끝났다 — 아직 성공도 실패도 아니다.
  if (items === null && !error) {
    return (
      <div className="space-y-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-16 rounded-lg border border-border bg-surface-secondary animate-pulse"
          />
        ))}
      </div>
    );
  }

  // FRT-319 — 전체 에러 화면은 **첫 조회 실패**에만 쓴다. 목록을 한 번이라도 받아 뒀다면
  // 그것을 지울 이유가 없다(그 뒤의 실패는 아래 배너로 알린다).
  if (items === null) {
    return (
      <div className="rounded-lg border border-border bg-surface-secondary p-5 text-center">
        <p className="text-body-sm text-text-secondary">
          목록을 불러오지 못했어요.
        </p>
        <Button variant="ghost" size="sm" onClick={load} className="mt-2">
          다시 시도
        </Button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <>
        {error && <ListRefreshErrorBanner onRetry={load} />}
        <div className="rounded-xl border border-dashed border-border bg-surface-secondary p-8 text-center">
          <FileText size={28} className="mx-auto text-text-tertiary" />
          <p className="text-body text-text-primary mt-3">
            아직 만든 레쥬메가 없어요.
          </p>
          <p className="text-body-sm text-text-secondary mt-1">
            첫 레쥬메를 만들어볼까요?
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={onCreateClick}
            className="mt-4"
          >
            새 레쥬메 만들기
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
    {error && <ListRefreshErrorBanner onRetry={load} />}
    <ul className="flex flex-col gap-2">
      {items.map((item) => {
        // status 가 없으면(구 백엔드) 기존처럼 이동 가능. 있으면 completed 만 이동 허용 —
        // 생성 중/실패 행은 상세 payload 가 아직 없거나 실패라 not-found/에러 화면으로 샌다.
        const isNavigable = !item.status || item.status === "completed";
        const rowContent = (
          <>
            <div className="min-w-0 flex-1">
              <span className="text-body-sm text-text-primary font-medium truncate block">
                {item.title || resumeLabel(item.created_at)}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {item.language && (
                  <span className="text-caption text-text-tertiary">
                    {item.language === "en" ? "영문" : "국문"}
                  </span>
                )}
                {item.status && item.status !== "completed" && (
                  <span
                    className={`text-caption ${
                      item.status === "failed" ? "text-error" : "text-text-tertiary"
                    }`}
                  >
                    {item.status === "failed" ? "실패" : "생성 중"}
                  </span>
                )}
              </div>
            </div>
            {/* 서버가 제목을 주지 않는 레쥬메는 라벨이 길어 truncate 로 잘린다 —
                만든 시각을 숨기면 모바일에서 어느 것이 방금 만든 건지 알 수 없다(FRT-126). */}
            {item.created_at && (
              <span className="text-caption text-text-tertiary shrink-0">
                {formatRelativeTime(item.created_at)}
              </span>
            )}
          </>
        );
        return (
        <li key={item.version_id}>
          <div className="group flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-border-strong">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-brand text-brand">
              <FileText size={16} />
            </div>
            {isNavigable ? (
              <Link
                href={`${basePath}/export/resume/${item.version_id}`}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                {rowContent}
              </Link>
            ) : (
              <div
                className="flex min-w-0 flex-1 items-center gap-3 cursor-default opacity-70"
                aria-disabled="true"
              >
                {rowContent}
              </div>
            )}
            <button
              type="button"
              onClick={() => setPendingDeleteId(item.version_id)}
              disabled={deletingId === item.version_id}
              className="text-text-tertiary hover:text-error transition-colors p-1.5 rounded-md disabled:opacity-40"
              aria-label="레쥬메 삭제"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </li>
        );
      })}
    </ul>
    <DeleteConfirmDialog
      open={pendingDeleteId !== null}
      title="이 레쥬메를 삭제할까요?"
      description="삭제하면 되돌릴 수 없어요."
      deleting={deletingId !== null}
      onClose={() => setPendingDeleteId(null)}
      onConfirm={() => {
        if (pendingDeleteId) handleDelete(pendingDeleteId);
      }}
    />
    </>
  );
}
