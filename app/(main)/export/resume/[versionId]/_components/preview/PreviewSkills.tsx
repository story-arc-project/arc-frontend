"use client";

import { isEmptySection, type Skills } from "@/types/resume";
import { PreviewSection } from "./PreviewSection";

interface Props {
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

export function PreviewSkills({ data }: Props) {
  if (isEmptySection(data)) return null;

  return (
    <PreviewSection title="기술 및 역량">
      <Group label="기술 스택" items={data.기술스택} />
      <Group label="툴" items={data.툴} />
      <Group label="소프트 스킬" items={data.소프트스킬} />
    </PreviewSection>
  );
}
