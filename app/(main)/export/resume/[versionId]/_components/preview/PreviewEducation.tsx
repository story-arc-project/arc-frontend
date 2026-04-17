"use client";

import { isEmptySection, type Education } from "@/types/resume";
import { PreviewRow, PreviewSection } from "./PreviewSection";

interface Props {
  data: Education[];
}

function formatEducationRight(edu: Education): string {
  const start = edu.입학년월 ?? "";
  const end = edu.졸업년월 ?? (edu.졸업구분 === "재학" ? "재학" : "");
  if (!start && !end) return "";
  if (!start) return end;
  if (!end) return start;
  return `${start} – ${end}`;
}

function formatGpa(edu: Education): string | null {
  if (edu.학점 === null || edu.학점 === undefined) return null;
  if (edu.만점 === null || edu.만점 === undefined) return `${edu.학점}`;
  return `${edu.학점} / ${edu.만점}`;
}

export function PreviewEducation({ data }: Props) {
  if (isEmptySection(data)) return null;

  return (
    <PreviewSection title="학력">
      {data.map((edu) => {
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
            right={formatEducationRight(edu)}
          />
        );
      })}
    </PreviewSection>
  );
}
