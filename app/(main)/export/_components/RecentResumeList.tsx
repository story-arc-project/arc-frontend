"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/client";
import { deleteResume, getResumeList } from "@/lib/api/export-api";
import { useBasePath } from "@/lib/utils/use-base-path";
import { formatDateTime, formatRelativeTime } from "@/lib/utils/date-utils";
import type { ResumeListItem } from "@/types/resume";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";

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

  const load = useCallback(async () => {
    try {
      const data = await getResumeList();
      setError(null);
      setItems(data);
    } catch (err) {
      setError(err as Error);
      setItems([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, reloadToken]);

  const handleDelete = async (versionId: string) => {
    setDeletingId(versionId);
    try {
      await deleteResume(versionId);
      setItems((prev) => (prev ?? []).filter((r) => r.version_id !== versionId));
      toast.success("레쥬메를 삭제했어요");
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setItems((prev) => (prev ?? []).filter((r) => r.version_id !== versionId));
      } else {
        toast.error("삭제에 실패했어요");
      }
    } finally {
      setDeletingId(null);
      // 성공·실패·삭제 미지원(버튼 자체가 사라지는 경로) 어디로 빠져도 다이얼로그를 닫는다.
      setPendingDeleteId(null);
    }
  };

  if (items === null) {
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

  if (error && items.length === 0) {
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
    );
  }

  return (
    <>
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
