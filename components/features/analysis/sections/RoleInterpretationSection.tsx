"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { RoleInterpretation } from "@/types/analysis";
import { Badge } from "@/components/ui";

interface RoleInterpretationSectionProps {
  interpretations: RoleInterpretation[];
}

export default function RoleInterpretationSection({
  interpretations,
}: RoleInterpretationSectionProps) {
  const [openIdx, setOpenIdx] = useState(0);

  return (
    <section className="space-y-4">
      <h3 className="text-title text-text-primary">
        역할 · 행동 · 성과 해석
      </h3>

      <div className="space-y-2">
        {interpretations.map((item, idx) => {
          const isOpen = openIdx === idx;
          const panelId = `role-panel-${item.incidentId}`;
          const triggerId = `role-trigger-${item.incidentId}`;
          return (
            <div
              key={item.incidentId}
              className="border border-border rounded-lg overflow-hidden"
            >
              <button
                id={triggerId}
                type="button"
                onClick={() => setOpenIdx(isOpen ? -1 : idx)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
              >
                <span className="text-body-sm text-text-primary font-medium">
                  사건 {idx + 1}: {item.role.responsibility}
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
                  className="px-4 pb-4 space-y-4 border-t border-border pt-3"
                >
                  <div>
                    <p className="text-caption text-text-tertiary font-medium mb-2">
                      역할
                    </p>
                    <div className="space-y-1 text-body-sm text-text-secondary">
                      <p>
                        <span className="text-text-tertiary">책임:</span>{" "}
                        {item.role.responsibility}
                      </p>
                      <p>
                        <span className="text-text-tertiary">범위:</span>{" "}
                        {item.role.scope}
                      </p>
                      <p>
                        <span className="text-text-tertiary">의사결정:</span>{" "}
                        {item.role.decisionAuthority}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-caption text-text-tertiary font-medium mb-2">
                      행동
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant="brand">{item.action.type}</Badge>
                      <span className="text-body-sm text-text-secondary">
                        {item.action.description}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-caption text-text-tertiary font-medium mb-2">
                      성과
                    </p>
                    <div className="space-y-1 text-body-sm text-text-secondary">
                      <p>
                        <span className="text-text-tertiary">지표:</span>{" "}
                        {item.performance.metric}
                      </p>
                      <p>
                        <span className="text-text-tertiary">산출물:</span>{" "}
                        {item.performance.output}
                      </p>
                      <p>
                        <span className="text-text-tertiary">변화:</span>{" "}
                        {item.performance.change}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
