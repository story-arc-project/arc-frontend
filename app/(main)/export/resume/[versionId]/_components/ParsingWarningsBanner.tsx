"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

interface Props {
  warnings: string[];
}

export function ParsingWarningsBanner({ warnings }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || warnings.length === 0) return null;

  return (
    <div className="no-print rounded-lg border border-brand/30 bg-surface-brand p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle
          size={18}
          className="mt-0.5 shrink-0 text-brand-dark"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="text-body-sm font-semibold text-text-primary">
            이 정보를 보완하면 더 좋은 레쥬메를 만들 수 있어요
          </p>
          <ul className="mt-2 list-disc space-y-0.5 pl-4 text-caption text-text-secondary">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
          <Link
            href="/archive"
            className="mt-3 inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-caption font-medium text-text-on-brand hover:bg-brand-dark transition-colors"
          >
            경험 보완하러 가기 →
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 p-1 text-text-tertiary hover:text-text-secondary transition-colors"
          aria-label="배너 닫기"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
