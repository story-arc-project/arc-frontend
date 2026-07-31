"use client";

import { isEmptySection, type Publication } from "@/types/resume";
import { PreviewRow, PreviewSection } from "./PreviewSection";

interface Props {
  title: string;
  data: Publication[] | undefined;
}

/**
 * 영문 전용 섹션(`publications`). 국문 레쥬메에는 `논문` 자체가 없어 항상 숨는다 —
 * `동아리_학회` 슬롯을 재사용하지 않는 이유는 그쪽 `구분` 이 국문 enum(교내동아리…)이라
 * 영문 CV 에 한국어 선택지가 새기 때문이다.
 */
export function PreviewPublication({ title, data }: Props) {
  if (isEmptySection(data)) return null;
  const items = (data ?? []).filter((p) => !isEmptySection(p));
  if (items.length === 0) return null;

  return (
    <PreviewSection title={title}>
      {items.map((p) => (
        <PreviewRow
          key={p.id}
          left={
            <div>
              <p className="text-body-sm font-semibold text-text-primary">
                {p.제목 ?? ""}
              </p>
              {p.게재처 && (
                <p className="text-caption text-text-secondary">{p.게재처}</p>
              )}
              {p.내용 && (
                <p className="mt-1 text-body-sm text-text-primary">{p.내용}</p>
              )}
            </div>
          }
          right={p.발표년월 ?? ""}
        />
      ))}
    </PreviewSection>
  );
}
