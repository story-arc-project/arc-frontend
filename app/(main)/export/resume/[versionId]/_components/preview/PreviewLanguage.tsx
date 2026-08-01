"use client";

import { isEmptySection, type LanguageItem } from "@/types/resume";
import type { ResumeSectionLabels } from "@/lib/export/resume-labels";
import { formatLanguageDetail } from "@/lib/export/resume-format";
import { PreviewRow, PreviewSection } from "./PreviewSection";

interface Props {
  labels: ResumeSectionLabels;
  data: LanguageItem[];
}

export function PreviewLanguage({ data, labels }: Props) {
  if (isEmptySection(data)) return null;
  const items = data.filter((l) => !isEmptySection(l));
  if (items.length === 0) return null;

  return (
    <PreviewSection title={labels.language}>
      {items.map((l) => {
        // 표기 규칙은 파일 내보내기와 한 곳(resume-format)에서 공유한다 — 화면과 PDF 가
        // 어학만 다르게 읽으면 "능통 (TOEFL 115)" 가 한쪽에만 뜬다.
        const detail = formatLanguageDetail(l);
        return (
          <PreviewRow
            key={l.id}
            left={
              <div>
                <p className="text-body-sm text-text-primary">
                  <span className="font-semibold">{l.언어 ?? ""}</span>
                  {detail && (
                    <span className="text-text-secondary">
                      {" · "}
                      {detail}
                    </span>
                  )}
                </p>
              </div>
            }
            right={l.취득년월 ?? ""}
          />
        );
      })}
    </PreviewSection>
  );
}
