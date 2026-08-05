"use client";

import type { Project } from "@/types/resume";
import type { ResumeSectionLabels } from "@/lib/export/resume-labels";
import { formatPeriod, PreviewBullets, PreviewRow, PreviewSection } from "./PreviewSection";
import { compactStrings } from "@/lib/export/resume-format";
import { visibleUsableExperiences } from "@/lib/export/resume-visibility";

interface Props {
  labels: ResumeSectionLabels;
  data: Project[];
}

export function PreviewProject({ data, labels }: Props) {
  const items = visibleUsableExperiences(data);
  if (items.length === 0) return null;

  return (
    <PreviewSection title={labels.project}>
      {items.map((p) => {
        // 배열 부재를 스스로 견딘다 (FRT-157) — 파일 내보내기의 resume-document 와 같은 형태.
        const techLine = compactStrings(p.사용기술).join(", ");
        const 성과 = compactStrings(p.성과);
        return (
          <div key={p.id}>
            <PreviewRow
              left={
                <div>
                  {p.프로젝트명 && (
                    <p className="text-body-sm font-semibold text-text-primary">
                      {p.프로젝트명}
                    </p>
                  )}
                  {(p.소속기관 || p.역할) && (
                    <p className="text-caption text-text-secondary">
                      {[p.소속기관, p.역할].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              }
              right={formatPeriod(p.기간_시작, p.기간_종료, p.기간_원문)}
            />
            <PreviewBullets items={p.내용} />
            {성과.length > 0 && (
              <div className="mt-1.5">
                <p className="text-caption text-text-tertiary font-medium">
                  {labels.achievements}
                </p>
                <PreviewBullets items={성과} />
              </div>
            )}
            {techLine && (
              <p className="mt-1 text-caption text-text-tertiary">
                <span className="font-medium">{labels.techStack}:</span> {techLine}
              </p>
            )}
          </div>
        );
      })}
    </PreviewSection>
  );
}
