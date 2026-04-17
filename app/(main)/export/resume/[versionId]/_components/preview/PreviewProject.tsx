"use client";

import { isEmptySection, type Project } from "@/types/resume";
import { formatPeriod, PreviewBullets, PreviewRow, PreviewSection } from "./PreviewSection";

interface Props {
  data: Project[];
}

export function PreviewProject({ data }: Props) {
  if (isEmptySection(data)) return null;

  return (
    <PreviewSection title="프로젝트">
      {data.map((p) => {
        const techLine = p.사용기술.filter((t) => t && t.trim()).join(", ");
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
            {p.성과.length > 0 && (
              <div className="mt-1.5">
                <p className="text-caption text-text-tertiary font-medium">
                  성과
                </p>
                <PreviewBullets items={p.성과} />
              </div>
            )}
            {techLine && (
              <p className="mt-1 text-caption text-text-tertiary">
                <span className="font-medium">사용 기술:</span> {techLine}
              </p>
            )}
          </div>
        );
      })}
    </PreviewSection>
  );
}
