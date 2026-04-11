"use client";

import { useState } from "react";
import type { MatchedExperience, KeywordDefinition } from "@/types/analysis";
import EvidenceQuote from "../common/EvidenceQuote";

interface MatchedExperienceSectionProps {
  matchedExperiences: MatchedExperience[];
  definitions: KeywordDefinition[];
}

export default function MatchedExperienceSection({
  matchedExperiences,
  definitions,
}: MatchedExperienceSectionProps) {
  const keywordIds = [...new Set(matchedExperiences.map((m) => m.keywordId))];
  const [activeKeyword, setActiveKeyword] = useState(keywordIds[0] ?? "");

  const filtered = matchedExperiences
    .filter((m) => m.keywordId === activeKeyword)
    .sort((a, b) => b.fitScore - a.fitScore);

  const activeDef = definitions.find((d) => d.keywordId === activeKeyword);

  return (
    <section className="space-y-4">
      <h3 className="text-title text-text-primary">키워드 부합 경험 목록</h3>

      {/* Keyword tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {keywordIds.map((kid) => {
          const def = definitions.find((d) => d.keywordId === kid);
          return (
            <button
              key={kid}
              type="button"
              onClick={() => setActiveKeyword(kid)}
              className={[
                "px-3 py-1.5 rounded-md text-label transition-colors",
                activeKeyword === kid
                  ? "bg-brand text-white"
                  : "text-text-secondary hover:text-text-primary border border-border hover:border-border-strong",
              ].join(" ")}
            >
              {def?.label ?? kid}
            </button>
          );
        })}
      </div>

      {/* Experience cards */}
      <div className="space-y-3">
        {filtered.map((exp) => (
          <div
            key={`${exp.keywordId}-${exp.experienceId}`}
            className="bg-surface border border-border rounded-lg p-4"
          >
            <div className="flex items-start gap-4">
              {/* Fit score */}
              <div className="shrink-0 text-center">
                <p className="text-heading-3 text-brand font-bold leading-none">
                  {exp.fitScore}%
                </p>
                <p className="text-caption text-text-tertiary mt-0.5">부합도</p>
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-body-sm text-text-primary font-medium">
                  {exp.title}
                </p>
                <EvidenceQuote evidence={exp.evidence} />
                {/* Matched criteria */}
                {activeDef && (
                  <div className="flex flex-wrap gap-1.5">
                    {activeDef.fitCriteria.map((fc) => {
                      const matched = exp.matchedCriteriaIds.includes(fc.id);
                      return (
                        <span
                          key={fc.id}
                          className={[
                            "text-caption px-2 py-0.5 rounded",
                            matched
                              ? "bg-surface-success text-success"
                              : "bg-surface-secondary text-text-tertiary line-through",
                          ].join(" ")}
                        >
                          {fc.description.slice(0, 25)}
                          {fc.description.length > 25 ? "…" : ""}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
