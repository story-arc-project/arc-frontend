"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PenLine, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/client";
import {
  CoverLetterMutationUnsupportedError,
  deleteCoverLetter,
  getCoverLetterList,
} from "@/lib/api/cover-letter-api";
import { useBasePath } from "@/lib/utils/use-base-path";
import { formatDateTime, formatRelativeTime } from "@/lib/utils/date-utils";
import type { CoverLetterListItem } from "@/types/cover-letter";

interface RecentCoverLetterListProps {
  onCreateClick: () => void;
  reloadToken?: number;
}

// 서버가 제목을 주지 않으면 만든 시각을 이름으로 쓴다(레쥬메 목록과 같은 규칙).
function coverLetterLabel(createdAt: string): string {
  if (!createdAt) return "자기소개서";
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "자기소개서";
  return `${formatDateTime(createdAt)} 자기소개서`;
}

export function RecentCoverLetterList({
  onCreateClick,
  reloadToken = 0,
}: RecentCoverLetterListProps) {
  const basePath = useBasePath();
  const [items, setItems] = useState<CoverLetterListItem[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [deleteSupported, setDeleteSupported] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getCoverLetterList();
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

  const handleDelete = async (id: string) => {
    if (!window.confirm("이 자기소개서를 삭제할까요?")) return;
    setDeletingId(id);
    try {
      await deleteCoverLetter(id);
      setItems((prev) => (prev ?? []).filter((c) => c.id !== id));
      toast.success("자기소개서를 삭제했어요");
    } catch (err) {
      if (err instanceof CoverLetterMutationUnsupportedError) {
        setDeleteSupported(false);
        toast("삭제 기능은 곧 제공될 예정이에요", "info");
      } else if (err instanceof ApiError && err.status === 404) {
        // 이미 없는 것을 지우려 한 것뿐이다 — 사용자가 원한 결과와 같으므로 목록에서 뺀다.
        setItems((prev) => (prev ?? []).filter((c) => c.id !== id));
      } else {
        toast.error("삭제에 실패했어요");
      }
    } finally {
      setDeletingId(null);
    }
  };

  if (items === null) {
    return (
      <div className="space-y-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-lg border border-border bg-surface-secondary"
          />
        ))}
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface-secondary p-5 text-center">
        <p className="text-body-sm text-text-secondary">목록을 불러오지 못했어요.</p>
        <Button variant="ghost" size="sm" onClick={load} className="mt-2">
          다시 시도
        </Button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-secondary p-8 text-center">
        <PenLine size={28} className="mx-auto text-text-tertiary" />
        <p className="mt-3 text-body text-text-primary">아직 만든 자기소개서가 없어요.</p>
        <p className="mt-1 text-body-sm text-text-secondary">
          문항을 넣으면 기록을 바탕으로 초안을 만들어요.
        </p>
        <Button variant="primary" size="sm" onClick={onCreateClick} className="mt-4">
          새 자기소개서 만들기
        </Button>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => {
        // status 가 없으면(구 백엔드) 이동 가능. 있으면 completed 만 허용 — 생성 중/실패 행은
        // 본문이 아직 없어 상세가 에러 화면으로 샌다(레쥬메 목록과 같은 판정).
        const isNavigable = !item.status || item.status === "completed";
        const rowContent = (
          <>
            <div className="min-w-0 flex-1">
              <span className="block truncate text-body-sm font-medium text-text-primary">
                {item.title || coverLetterLabel(item.created_at)}
              </span>
              {item.status && item.status !== "completed" && (
                <span
                  className={`mt-0.5 block text-caption ${
                    item.status === "failed" ? "text-error" : "text-text-tertiary"
                  }`}
                >
                  {item.status === "failed" ? "실패" : "생성 중"}
                </span>
              )}
            </div>
            {item.created_at && (
              <span className="hidden shrink-0 text-caption text-text-tertiary sm:inline">
                {formatRelativeTime(item.created_at)}
              </span>
            )}
          </>
        );

        return (
          <li key={item.id}>
            <div className="group flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-border-strong">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-brand text-brand">
                <PenLine size={16} />
              </div>
              {isNavigable ? (
                <Link
                  href={`${basePath}/export/cover-letter/${item.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  {rowContent}
                </Link>
              ) : (
                <div
                  className="flex min-w-0 flex-1 cursor-default items-center gap-3 opacity-70"
                  aria-disabled="true"
                >
                  {rowContent}
                </div>
              )}
              {deleteSupported && (
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  disabled={deletingId === item.id}
                  className="rounded-md p-1.5 text-text-tertiary transition-colors hover:text-error disabled:opacity-40"
                  aria-label="자기소개서 삭제"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
