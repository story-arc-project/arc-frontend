"use client";

import { ArrowLeft, Printer, RefreshCcw, Save } from "lucide-react";
import { Button } from "@/components/ui";

interface ResumeDetailTopBarProps {
  versionLabel: string;
  dirty: boolean;
  saving: boolean;
  regenerating: boolean;
  onBack: () => void;
  onSave: () => void;
  onRegenerate: () => void;
  onPrint: () => void;
}

export function ResumeDetailTopBar({
  versionLabel,
  dirty,
  saving,
  regenerating,
  onBack,
  onSave,
  onRegenerate,
  onPrint,
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
          onClick={onSave}
          disabled={!dirty || saving}
        >
          <Save size={13} className="mr-1" />
          {saving ? "저장 중..." : "저장"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRegenerate}
          disabled={regenerating}
        >
          <RefreshCcw size={13} className="mr-1" />
          다시 만들기
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onPrint}
          title="인쇄 창에서 '대상'을 'PDF로 저장'으로 선택하세요"
        >
          <Printer size={13} className="mr-1" />
          PDF 다운로드
        </Button>
      </div>
    </header>
  );
}
