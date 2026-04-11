"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { IncidentCard } from "@/types/analysis";
import EvidenceQuote from "../common/EvidenceQuote";

interface ExperienceSummarySectionProps {
  summary: string;
  incidents: IncidentCard[];
}

export default function ExperienceSummarySection({
  summary,
  incidents,
}: ExperienceSummarySectionProps) {
  const [openId, setOpenId] = useState<string | null>(
    incidents[0]?.id ?? null
  );

  return (
    <section className="space-y-4">
      <h3 className="text-title text-text-primary">경험 요약 · 사건 분해</h3>
      <p className="text-body text-text-secondary leading-relaxed">{summary}</p>

      <div className="space-y-2">
        {incidents.map((inc) => {
          const isOpen = openId === inc.id;
          const panelId = `incident-panel-${inc.id}`;
          const triggerId = `incident-trigger-${inc.id}`;
          return (
            <div
              key={inc.id}
              className="border border-border rounded-lg overflow-hidden"
            >
              <button
                id={triggerId}
                type="button"
                onClick={() => setOpenId(isOpen ? null : inc.id)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
              >
                <span className="text-body-sm text-text-primary font-medium truncate pr-2">
                  {inc.situation.slice(0, 60)}
                  {inc.situation.length > 60 ? "..." : ""}
                </span>
                <ChevronDown
                  size={16}
                  className={[
                    "shrink-0 text-text-tertiary transition-transform duration-200",
                    isOpen ? "rotate-180" : "",
                  ].join(" ")}
                  aria-hidden="true"
                />
              </button>
              {isOpen && (
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={triggerId}
                  className="px-4 pb-4 space-y-3 border-t border-border pt-3"
                >
                  <div>
                    <p className="text-caption text-text-tertiary font-medium mb-1">
                      상황
                    </p>
                    <p className="text-body-sm text-text-secondary">
                      {inc.situation}
                    </p>
                  </div>
                  <div>
                    <p className="text-caption text-text-tertiary font-medium mb-1">
                      행동
                    </p>
                    <p className="text-body-sm text-text-secondary">
                      {inc.action}
                    </p>
                  </div>
                  <div>
                    <p className="text-caption text-text-tertiary font-medium mb-1">
                      결과
                    </p>
                    <p className="text-body-sm text-text-secondary">
                      {inc.result}
                    </p>
                  </div>
                  <EvidenceQuote evidence={inc.evidence} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
