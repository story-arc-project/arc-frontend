"use client";

import { isEmptySection, type Club } from "@/types/resume";
import { PreviewBullets, PreviewRow, PreviewSection } from "./PreviewSection";

interface Props {
  data: Club[];
}

export function PreviewClub({ data }: Props) {
  if (isEmptySection(data)) return null;
  const items = data.filter((c) => !isEmptySection(c));
  if (items.length === 0) return null;

  return (
    <PreviewSection title="동아리 · 학회">
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
