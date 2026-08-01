"use client";

import { isEmptySection, type Skills } from "@/types/resume";
import type { ResumeSectionLabels } from "@/lib/export/resume-labels";
import { PreviewSection } from "./PreviewSection";

interface Props {
  labels: ResumeSectionLabels;
  data: Skills;
}

function Group({ label, items }: { label: string; items: string[] }) {
  const filtered = items.filter((s) => s && s.trim());
  if (filtered.length === 0) return null;
  return (
    <div className="flex gap-3">
      <p className="w-20 shrink-0 text-caption text-text-tertiary font-medium pt-0.5">
        {label}
      </p>
      <div className="flex-1 flex flex-wrap gap-1.5">
        {filtered.map((item, i) => (
          <span
            key={i}
            className="inline-flex items-center rounded-sm bg-surface-tertiary px-2 py-0.5 text-caption text-text-primary"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

export function PreviewSkills({ data, labels }: Props) {
  if (isEmptySection(data)) return null;

  return (
    <PreviewSection title={labels.skills}>
      <Group label={labels.skillTech} items={data.기술스택} />
      <Group label={labels.skillTools} items={data.툴} />
      <Group label={labels.skillSoft} items={data.소프트스킬} />
    </PreviewSection>
  );
}
