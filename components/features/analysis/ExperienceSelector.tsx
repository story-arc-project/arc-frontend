"use client";

import { X } from "lucide-react";

interface SelectableExperience {
  id: string;
  title: string;
  type: string;
  importance: number;
  isComplete: boolean;
}

interface ExperienceSelectorProps {
  experiences: SelectableExperience[];
  selected: string[];
  onChange: (ids: string[]) => void;
  minCount?: number;
}

export default function ExperienceSelector({
  experiences,
  selected,
  onChange,
  minCount = 2,
}: ExperienceSelectorProps) {
  const completeExps = experiences.filter((e) => e.isComplete);

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  function remove(id: string) {
    onChange(selected.filter((s) => s !== id));
  }

  return (
    <div className="space-y-4">
      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((id) => {
            const exp = experiences.find((e) => e.id === id);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 bg-surface-brand text-brand rounded-full px-3 py-1 text-label"
              >
                {exp?.title ?? id}
                <button
                  type="button"
                  onClick={() => remove(id)}
                  className="hover:text-brand-dark"
                >
                  <X size={12} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Guide text */}
      <p className="text-body-sm text-text-tertiary">
        {selected.length < minCount
          ? `${minCount}개 이상 선택해주세요 (현재 ${selected.length}개)`
          : `${selected.length}개 선택됨`}
      </p>

      {/* Experience list */}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {completeExps.map((exp) => {
          const checked = selected.includes(exp.id);
          return (
            <label
              key={exp.id}
              className={[
                "flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors",
                checked
                  ? "border-brand bg-surface-brand"
                  : "border-border hover:border-border-strong",
              ].join(" ")}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(exp.id)}
                className="sr-only"
              />
              <div
                className={[
                  "w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors",
                  checked ? "bg-brand border-brand" : "border-border-strong",
                ].join(" ")}
              >
                {checked && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path
                      d="M1 4L3.5 6.5L9 1"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-body-sm text-text-primary font-medium">
                  {exp.title}
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-caption text-text-tertiary">
                    {exp.type}
                  </span>
                  <span className="text-caption text-text-tertiary">
                    중요도 {exp.importance}
                  </span>
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
