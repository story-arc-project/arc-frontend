"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import type { ReusableExpression } from "@/types/analysis";

interface ReusableExpressionSectionProps {
  expressions: ReusableExpression[];
}

function ExpressionCard({ expr }: { expr: ReusableExpression }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(expr.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-label text-text-tertiary">{expr.label}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-tertiary transition-colors"
          aria-label="복사"
        >
          {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
        </button>
      </div>
      <p className="text-body-sm text-text-secondary leading-relaxed">
        {expr.text}
      </p>
    </div>
  );
}

export default function ReusableExpressionSection({
  expressions,
}: ReusableExpressionSectionProps) {
  return (
    <section className="space-y-4">
      <h3 className="text-title text-text-primary">
        재사용 표현 (면접/자소서)
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {expressions.map((expr) => (
          <ExpressionCard key={expr.type} expr={expr} />
        ))}
      </div>
    </section>
  );
}
