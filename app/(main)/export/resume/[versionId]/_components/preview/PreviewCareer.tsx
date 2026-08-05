"use client";

import type { Career } from "@/types/resume";
import type { ResumeSectionLabels } from "@/lib/export/resume-labels";
import { formatPeriod, PreviewBullets, PreviewRow, PreviewSection } from "./PreviewSection";
import { compactStrings } from "@/lib/export/resume-format";
import { visibleUsableExperiences } from "@/lib/export/resume-visibility";

interface Props {
  labels: ResumeSectionLabels;
  data: Career[];
}

export function PreviewCareer({ data, labels }: Props) {
  const items = visibleUsableExperiences(data);
  if (items.length === 0) return null;

  return (
    <PreviewSection title={labels.career}>
      {items.map((c) => {
        const subline = [c.부서, c.직위, c.고용형태]
          .filter((v) => v && String(v).trim())
          .join(" · ");
        // 라벨은 실제로 그릴 성과가 남았을 때만 (FRT-157) — 파일 내보내기와 같은 판정.
        const 성과 = compactStrings(c.성과);

        return (
          <div key={c.id}>
            <PreviewRow
              left={
                <div>
                  {c.회사명 && (
                    <p className="text-body-sm font-semibold text-text-primary">
                      {c.회사명}
                    </p>
                  )}
                  {subline && (
                    <p className="text-caption text-text-secondary">
                      {subline}
                    </p>
                  )}
                </div>
              }
              right={formatPeriod(
                c.입사년월,
                c.퇴사년월,
                null,
                c.재직중 ? labels.present : null,
              )}
            />
            <PreviewBullets items={c.담당업무} />
            {성과.length > 0 && (
              <div className="mt-1.5">
                <p className="text-caption text-text-tertiary font-medium">
                  {labels.achievements}
                </p>
                <PreviewBullets items={성과} />
              </div>
            )}
          </div>
        );
      })}
    </PreviewSection>
  );
}
