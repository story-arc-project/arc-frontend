"use client";

import { History } from "lucide-react";
import { Button } from "@/components/ui";

interface Props {
  updatedAt: string;
  onRestore: () => void;
  onDiscard: () => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
}

export function DraftRestoreBanner({ updatedAt, onRestore, onDiscard }: Props) {
  return (
    <div className="no-print flex items-start gap-3 rounded-lg border border-info/30 bg-surface-secondary p-4">
      <History size={18} className="mt-0.5 shrink-0 text-info" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-body-sm font-semibold text-text-primary">
          저장하지 못한 편집 내용이 있어요
        </p>
        <p className="mt-0.5 text-caption text-text-secondary">
          {formatTime(updatedAt)}에 자동 저장된 내용이에요.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onDiscard}>
          삭제
        </Button>
        <Button variant="primary" size="sm" onClick={onRestore}>
          복원
        </Button>
      </div>
    </div>
  );
}
