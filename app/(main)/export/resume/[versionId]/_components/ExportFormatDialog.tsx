"use client";

import { FilePen, FileText, Printer, type LucideIcon } from "lucide-react";
import { Dialog } from "@/components/ui";

export type ExportFormat = "pdf" | "docx" | "print";

interface Props {
  open: boolean;
  /** 생성 중인 형식. 하나가 도는 동안 나머지도 잠근다. */
  busy: ExportFormat | null;
  onClose: () => void;
  onSelect: (format: ExportFormat) => void;
}

interface Choice {
  format: ExportFormat;
  icon: LucideIcon;
  label: string;
  description: string;
  busyLabel: string;
}

const CHOICES: Choice[] = [
  {
    format: "pdf",
    icon: FileText,
    label: "PDF",
    description: "제출용 표준이에요. 글자를 그대로 복사할 수 있어요.",
    busyLabel: "PDF를 만들고 있어요...",
  },
  {
    format: "docx",
    // 펜 달린 아이콘 — "받은 뒤 직접 고칠 수 있다"는 이 선택지의 이유를 그림으로 반복한다.
    icon: FilePen,
    label: "Word (.docx)",
    description: "받은 뒤에 직접 더 고칠 수 있어요.",
    busyLabel: "Word 파일을 만들고 있어요...",
  },
  {
    format: "print",
    icon: Printer,
    label: "인쇄",
    description: "브라우저 인쇄 창을 열어요.",
    busyLabel: "인쇄 창을 여는 중이에요...",
  },
];

export function ExportFormatDialog({ open, busy, onClose, onSelect }: Props) {
  const working = busy !== null;

  return (
    <Dialog
      open={open}
      onClose={working ? () => {} : onClose}
      ariaLabel="내보내기 형식 선택"
      className="max-w-sm"
    >
      <h2 className="text-title text-text-primary">어떤 형식으로 받을까요?</h2>
      <p className="text-body-sm text-text-secondary mt-1">
        지금 화면에 보이는 내용 그대로 저장돼요.
      </p>

      <div className="mt-4 flex flex-col gap-2">
        {CHOICES.map(({ format, icon: Icon, label, description, busyLabel }) => {
          const isBusy = busy === format;
          return (
            <button
              key={format}
              type="button"
              onClick={() => onSelect(format)}
              disabled={working}
              className="flex min-h-11 items-start gap-3 rounded-md border border-border px-3 py-3 text-left transition-colors hover:border-brand hover:bg-surface-tertiary disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Icon
                size={16}
                className="mt-0.5 shrink-0 text-text-secondary"
                aria-hidden
              />
              <span className="min-w-0">
                <span className="block text-body-sm text-text-primary">
                  {label}
                </span>
                <span className="block text-caption text-text-secondary">
                  {isBusy ? busyLabel : description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </Dialog>
  );
}
