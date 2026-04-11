"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";
import type { KeywordSuggestion, KeywordCategory } from "@/types/analysis";
import { keywordCategoryLabel } from "@/types/analysis";
import { Badge, Input } from "@/components/ui";

interface SelectedKeyword {
  label: string;
  category: KeywordCategory;
}

interface KeywordSelectorProps {
  suggestions: KeywordSuggestion[];
  selected: SelectedKeyword[];
  onChange: (keywords: SelectedKeyword[]) => void;
  maxCount?: number;
}

const CATEGORIES: { key: KeywordCategory; label: string }[] = [
  { key: "skill", label: "직무/스킬" },
  { key: "work_style", label: "업무 성향" },
  { key: "value", label: "가치관" },
  { key: "job_domain", label: "직종/업무" },
];

export default function KeywordSelector({
  suggestions,
  selected,
  onChange,
  maxCount = 3,
}: KeywordSelectorProps) {
  const [customLabel, setCustomLabel] = useState("");
  const [customCategory, setCustomCategory] = useState<KeywordCategory>("skill");

  function addSuggestion(sug: KeywordSuggestion) {
    if (selected.length >= maxCount) return;
    if (selected.some((s) => s.label === sug.label)) return;
    onChange([...selected, { label: sug.label, category: sug.category }]);
  }

  function addCustom() {
    const label = customLabel.trim();
    if (!label || selected.length >= maxCount) return;
    if (selected.some((s) => s.label === label)) return;
    onChange([...selected, { label, category: customCategory }]);
    setCustomLabel("");
  }

  function remove(label: string) {
    onChange(selected.filter((s) => s.label !== label));
  }

  return (
    <div className="space-y-4">
      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((kw) => (
            <span
              key={kw.label}
              className="inline-flex items-center gap-1.5 bg-surface-brand text-brand rounded-full px-3 py-1 text-label"
            >
              {kw.label}
              <button type="button" onClick={() => remove(kw.label)} className="hover:text-brand-dark">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <p className="text-body-sm text-text-tertiary">
        {selected.length >= maxCount
          ? `최대 ${maxCount}개까지 선택할 수 있습니다.`
          : `${selected.length}/${maxCount}개 선택됨`}
      </p>

      {/* Suggestions */}
      <div>
        <p className="text-label text-text-tertiary mb-2">추천 키워드</p>
        <div className="space-y-2">
          {suggestions.map((sug) => {
            const isSelected = selected.some((s) => s.label === sug.label);
            return (
              <button
                key={sug.id}
                type="button"
                disabled={isSelected || selected.length >= maxCount}
                onClick={() => addSuggestion(sug)}
                className={[
                  "w-full text-left px-4 py-3 rounded-lg border transition-colors",
                  isSelected
                    ? "border-brand bg-surface-brand"
                    : "border-border hover:border-brand disabled:opacity-50 disabled:cursor-not-allowed",
                ].join(" ")}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-body-sm text-text-primary font-medium">
                    {sug.label}
                  </span>
                  <Badge variant="outline">
                    {keywordCategoryLabel[sug.category]}
                  </Badge>
                  <span className="text-caption text-text-tertiary ml-auto">
                    관련 경험 {sug.relatedExperienceCount}개
                  </span>
                </div>
                <p className="text-body-sm text-text-secondary">{sug.reason}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom input */}
      <div>
        <p className="text-label text-text-tertiary mb-2">직접 입력</p>
        <div className="flex gap-2">
          <Input
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            placeholder="키워드 입력"
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
          />
          <select
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value as KeywordCategory)}
            className="px-3 py-2 text-body-sm border border-border rounded-md bg-surface text-text-primary"
          >
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addCustom}
            disabled={!customLabel.trim() || selected.length >= maxCount}
            className="p-2 rounded-md bg-brand text-white hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
