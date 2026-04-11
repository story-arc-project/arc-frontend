import type { Evidence } from "@/types/analysis";

interface EvidenceQuoteProps {
  evidence: Evidence;
  className?: string;
}

export default function EvidenceQuote({ evidence, className = "" }: EvidenceQuoteProps) {
  return (
    <blockquote
      className={[
        "border-l-2 border-border-strong pl-3 py-1",
        className,
      ].join(" ")}
    >
      <p className="text-body-sm text-text-secondary italic leading-relaxed">
        &ldquo;{evidence.quote}&rdquo;
      </p>
      <footer className="mt-1 flex items-center gap-2 flex-wrap">
        {evidence.experienceTitle && (
          <span className="text-caption text-text-tertiary">
            &mdash; {evidence.experienceTitle}
          </span>
        )}
        {evidence.sourceField && (
          <span className="text-caption text-text-tertiary bg-surface-secondary px-1.5 py-0.5 rounded">
            {evidence.sourceField}
          </span>
        )}
      </footer>
    </blockquote>
  );
}
