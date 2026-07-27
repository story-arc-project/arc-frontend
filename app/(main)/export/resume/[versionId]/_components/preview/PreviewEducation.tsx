"use client";

// 기간·학점 표기는 파일 내보내기(PDF·DOCX)와 같은 규칙을 써야 한다 — 단일 출처는 lib/export/resume-format.
import { formatEducationPeriod, formatGpa } from "@/lib/export/resume-format";
import { isEmptySection, type Education } from "@/types/resume";
import { PreviewRow, PreviewSection } from "./PreviewSection";

interface Props {
  data: Education[];
}

export function PreviewEducation({ data }: Props) {
  if (isEmptySection(data)) return null;
  const items = data.filter((edu) => !isEmptySection(edu));
  if (items.length === 0) return null;

  return (
    <PreviewSection title="학력">
      {items.map((edu) => {
        const subline = [
          edu.학과,
          edu.전공구분,
          edu.학위,
          edu.졸업구분,
        ]
          .filter((v) => v && String(v).trim())
          .join(" · ");
        const gpa = formatGpa(edu);

        return (
          <PreviewRow
            key={edu.id}
            left={
              <div>
                {edu.학교명 && (
                  <p className="text-body-sm font-semibold text-text-primary">
                    {edu.학교명}
                  </p>
                )}
                {subline && (
                  <p className="text-caption text-text-secondary">{subline}</p>
                )}
                {(gpa || edu.비고) && (
                  <p className="text-caption text-text-tertiary">
                    {[gpa, edu.비고].filter(Boolean).join("  ·  ")}
                  </p>
                )}
              </div>
            }
            right={formatEducationPeriod(edu)}
          />
        );
      })}
    </PreviewSection>
  );
}
