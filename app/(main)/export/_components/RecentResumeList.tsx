"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import {
  deleteResume,
  getResumeList,
  ResumeMutationUnsupportedError,
} from "@/lib/api/export-api";
import type { ResumeListItem } from "@/types/resume";

interface RecentResumeListProps {
  onCreateClick: () => void;
}

const languageFlag: Record<string, string> = {
  ko: "🇰🇷",
  en: "🇺🇸",
};

function formatGeneratedAt(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
}

function shortenId(versionId: string): string {
  if (!versionId) return "";
  return versionId.length > 8 ? versionId.slice(0, 8) : versionId;
}

export function RecentResumeList({ onCreateClick }: RecentResumeListProps) {
  const [items, setItems] = useState<ResumeListItem[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [deleteSupported, setDeleteSupported] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getResumeList();
      setItems(data);
    } catch (err) {
      setError(err as Error);
      setItems([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (versionId: string) => {
    if (!window.confirm("이 레쥬메를 삭제할까요?")) return;
    setDeletingId(versionId);
    try {
      await deleteResume(versionId);
      setItems((prev) => (prev ?? []).filter((r) => r.version_id !== versionId));
      toast.success("레쥬메를 삭제했어요");
    } catch (err) {
      if (err instanceof ResumeMutationUnsupportedError) {
        setDeleteSupported(false);
        toast("삭제 기능은 곧 제공될 예정이에요", "info");
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
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.version_id}>
          <div className="group flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-border-strong">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-brand text-brand">
              <FileText size={16} />
            </div>
            <Link
              href={`/export/resume/${item.version_id}`}
              className="flex min-w-0 flex-1 items-center gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-body-sm text-text-primary font-medium truncate">
                    레쥬메 #{shortenId(item.version_id)}
                  </span>
                  <span className="text-caption text-text-tertiary shrink-0">
                    {languageFlag[item.language] ?? ""}
                  </span>
                </div>
                <p className="text-caption text-text-secondary truncate">
                  {item.summary_preview ?? "요약 미리보기가 없어요"}
                </p>
              </div>
              <span className="text-caption text-text-tertiary shrink-0 hidden sm:inline">
                {formatGeneratedAt(item.generated_at)}
              </span>
            </Link>
            {deleteSupported && (
              <button
                type="button"
                onClick={() => handleDelete(item.version_id)}
                disabled={deletingId === item.version_id}
                className="text-text-tertiary hover:text-error transition-colors p-1.5 rounded-md disabled:opacity-40"
                aria-label="레쥬메 삭제"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
