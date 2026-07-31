"use client";

import { isEmptySection, type Activity } from "@/types/resume";
import type { ResumeSectionLabels } from "@/lib/export/resume-labels";
import { formatPeriod, PreviewBullets, PreviewRow, PreviewSection } from "./PreviewSection";
import { visibleExperiences } from "@/lib/export/resume-visibility";

interface Props {
  labels: ResumeSectionLabels;
  data: Activity[];
}

export function PreviewActivity({ data, labels }: Props) {
  if (isEmptySection(data)) return null;
  const items = visibleExperiences(data).filter((a) => !isEmptySection(a));
  if (items.length === 0) return null;

  return (
    <PreviewSection title={labels.activity}>
      {items.map((a) => (
        <div key={a.id}>
          <PreviewRow
            left={
              <div>
                {a.활동명 && (
                  <p className="text-body-sm font-semibold text-text-primary">
                    {a.활동명}
                  </p>
                )}
                {(a.기관 || a.역할) && (
                  <p className="text-caption text-text-secondary">
                    {[a.기관, a.역할].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            }
            right={formatPeriod(a.기간_시작, a.기간_종료, a.기간_원문, a.진행중)}
          />
          <PreviewBullets items={a.활동내용} />
          {a.성과.length > 0 && (
            <div className="mt-1.5">
              <p className="text-caption text-text-tertiary font-medium">{labels.achievements}</p>
              <PreviewBullets items={a.성과} />
            </div>
          )}
        </div>
      ))}
    </PreviewSection>
  );
}
