"use client";

import type { Club } from "@/types/resume";
import type { ResumeSectionLabels } from "@/lib/export/resume-labels";
import { PreviewBullets, PreviewRow, PreviewSection } from "./PreviewSection";
import { visibleUsableExperiences } from "@/lib/export/resume-visibility";

interface Props {
  labels: ResumeSectionLabels;
  data: Club[];
}

export function PreviewClub({ data, labels }: Props) {
  const items = visibleUsableExperiences(data);
  if (items.length === 0) return null;

  return (
    <PreviewSection title={labels.club}>
      {items.map((c) => (
        <div key={c.id}>
          <PreviewRow
            left={
              <div>
                {c.단체명 && (
                  <p className="text-body-sm font-semibold text-text-primary">
                    {c.단체명}
                  </p>
                )}
                {(c.구분 || c.역할) && (
                  <p className="text-caption text-text-secondary">
                    {[c.구분, c.역할].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            }
            right={c.기간_원문 ?? ""}
          />
          <PreviewBullets items={c.활동내용} />
        </div>
      ))}
    </PreviewSection>
  );
}
