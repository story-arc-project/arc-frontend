"use client";

import { isEmptySection, type Certification } from "@/types/resume";
import { PreviewRow, PreviewSection } from "./PreviewSection";

interface Props {
  data: Certification[];
}

export function PreviewCertification({ data }: Props) {
  if (isEmptySection(data)) return null;

  return (
    <PreviewSection title="자격증">
      {data.map((c) => (
        <PreviewRow
          key={c.id}
          left={
            <div>
              {c.자격증명 && (
                <p className="text-body-sm font-semibold text-text-primary">
                  {c.자격증명}
                </p>
              )}
              {(c.발급기관 || c.자격구분) && (
                <p className="text-caption text-text-secondary">
                  {[c.발급기관, c.자격구분].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          }
          right={c.취득년월 ?? ""}
        />
      ))}
    </PreviewSection>
  );
}
