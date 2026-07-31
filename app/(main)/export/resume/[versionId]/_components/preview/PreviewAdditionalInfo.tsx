"use client";

import { isEmptySection, type AdditionalInfo } from "@/types/resume";
import { PreviewRow, PreviewSection } from "./PreviewSection";

interface Props {
  title: string;
  data: AdditionalInfo | undefined;
}

/**
 * rev.5 신규 섹션 — 병역·관심사. 어학은 여기 오지 않는다("기타 정보에는 어학 외의 것만",
 * 7/27 확정). 백엔드가 아직 이 섹션을 내지 않으므로 지금은 항상 숨는다.
 */
export function PreviewAdditionalInfo({ title, data }: Props) {
  if (!data || isEmptySection(data)) return null;

  const rows = [
    { label: "병역", value: (data.병역 ?? "").trim() },
    {
      label: "관심사",
      value: (data.관심사 ?? []).filter((v) => v && v.trim()).join(", "),
    },
  ].filter((row) => row.value !== "");
  if (rows.length === 0) return null;

  return (
    <PreviewSection title={title}>
      {rows.map((row) => (
        <PreviewRow
          key={row.label}
          left={
            <p className="text-body-sm text-text-primary">
              <span className="font-semibold">{row.label}</span>
              <span className="text-text-secondary">
                {" · "}
                {row.value}
              </span>
            </p>
          }
        />
      ))}
    </PreviewSection>
  );
}
