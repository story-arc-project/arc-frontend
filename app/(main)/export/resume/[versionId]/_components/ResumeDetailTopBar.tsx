"use client";

import { ArrowLeft, Download, RefreshCcw, Save } from "lucide-react";
import { Button } from "@/components/ui";

interface ResumeDetailTopBarProps {
  versionLabel: string;
  dirty: boolean;
  saving: boolean;
  regenerating: boolean;
  onBack: () => void;
  onSave: () => void;
  onRegenerate: () => void;
  onExport: () => void;
}

export function ResumeDetailTopBar({
  versionLabel,
  dirty,
  saving,
  regenerating,
  onBack,
  onSave,
  onRegenerate,
  onExport,
}: ResumeDetailTopBarProps) {
  return (
    <header
      className="no-print sticky top-[var(--gnb-h)] z-40 flex h-14 items-center gap-2 border-b border-border bg-surface/90 px-4 backdrop-blur-sm sm:px-6"
    >
      <button
        type="button"
        onClick={onBack}
        aria-label="익스포트로 돌아가기"
        className="flex h-9 w-9 items-center justify-center rounded-md text-text-secondary hover:bg-surface-tertiary hover:text-text-primary transition-colors"
      >
        <ArrowLeft size={16} />
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-body-sm text-text-primary truncate">
          {versionLabel}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="min-h-11 shrink-0 sm:min-h-0"
          onClick={onSave}
          disabled={!dirty || saving}
        >
          <Save size={13} className="mr-1" />
          {saving ? "저장 중..." : "저장"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="min-h-11 shrink-0 sm:min-h-0"
          aria-label="다시 만들기"
          onClick={onRegenerate}
          disabled={regenerating}
        >
          <RefreshCcw size={13} className="mr-1" />
          <span className="sm:hidden">다시</span>
          <span className="hidden sm:inline">다시 만들기</span>
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="min-h-11 shrink-0 sm:min-h-0"
          aria-label="내보내기"
          onClick={onExport}
        >
          {/* 모바일은 아이콘만 — 옆의 '저장' 버튼과 라벨이 헷갈리지 않게(FRT-63 패턴). */}
          <Download size={13} className="sm:mr-1" />
          <span className="hidden sm:inline">내보내기</span>
        </Button>
      </div>
    </header>
  );
}
