"use client";

import { isEmptySection, type Activity } from "@/types/resume";
import { formatPeriod, PreviewBullets, PreviewRow, PreviewSection } from "./PreviewSection";

interface Props {
  data: Activity[];
}

export function PreviewActivity({ data }: Props) {
  if (isEmptySection(data)) return null;

  return (
    <PreviewSection title="대외활동">
      {data.map((a) => (
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
              <p className="text-caption text-text-tertiary font-medium">성과</p>
              <PreviewBullets items={a.성과} />
            </div>
          )}
        </div>
      ))}
    </PreviewSection>
  );
}
