"use client";

import { isEmptySection, type Career } from "@/types/resume";
import { formatPeriod, PreviewBullets, PreviewRow, PreviewSection } from "./PreviewSection";

interface Props {
  data: Career[];
}

export function PreviewCareer({ data }: Props) {
  if (isEmptySection(data)) return null;
  const items = data.filter((c) => !isEmptySection(c));
  if (items.length === 0) return null;

  return (
    <PreviewSection title="경력">
      {items.map((c) => {
        const subline = [c.부서, c.직위, c.고용형태]
          .filter((v) => v && String(v).trim())
          .join(" · ");

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
              right={formatPeriod(c.입사년월, c.퇴사년월, null, c.재직중)}
            />
            <PreviewBullets items={c.담당업무} />
            {c.성과.length > 0 && (
              <div className="mt-1.5">
                <p className="text-caption text-text-tertiary font-medium">
                  성과
                </p>
                <PreviewBullets items={c.성과} />
              </div>
            )}
          </div>
        );
      })}
    </PreviewSection>
  );
}
