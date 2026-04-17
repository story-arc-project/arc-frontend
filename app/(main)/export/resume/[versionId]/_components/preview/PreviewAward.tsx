"use client";

import { isEmptySection, type Award } from "@/types/resume";
import { PreviewRow, PreviewSection } from "./PreviewSection";

interface Props {
  data: Award[];
}

export function PreviewAward({ data }: Props) {
  if (isEmptySection(data)) return null;

  return (
    <PreviewSection title="수상">
      {data.map((a) => (
        <PreviewRow
          key={a.id}
          left={
            <div>
              {a.수상명 && (
                <p className="text-body-sm font-semibold text-text-primary">
                  {a.수상명}
                </p>
              )}
              {a.수여기관 && (
                <p className="text-caption text-text-secondary">
                  {a.수여기관}
                </p>
              )}
              {a.내용 && (
                <p className="text-caption text-text-tertiary">{a.내용}</p>
              )}
            </div>
          }
          right={a.수상년월 ?? ""}
        />
      ))}
    </PreviewSection>
  );
}
