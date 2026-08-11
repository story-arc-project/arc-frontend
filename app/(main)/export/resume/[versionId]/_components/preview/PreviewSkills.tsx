"use client";

import { isEmptySection, type Skills } from "@/types/resume";
import type { ResumeSectionLabels } from "@/lib/export/resume-labels";
import { compactStrings } from "@/lib/export/resume-format";
import { PreviewSection } from "./PreviewSection";

interface Props {
  labels: ResumeSectionLabels;
  data: Skills;
}

// isEmptySection 은 기술및역량 **전체**가 비었는지만 본다 — 기술스택만 채워지고 툴이
// 빠진 본문은 그 관문을 통과하므로, 갈래마다 스스로 배열 부재를 견뎌야 한다(FRT-157).
function Group({
  label,
  items,
}: {
  label: string;
  items: readonly string[] | null | undefined;
}) {
  const filtered = compactStrings(items);
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
