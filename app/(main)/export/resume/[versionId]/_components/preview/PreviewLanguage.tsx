"use client";

import { isEmptySection, type LanguageItem } from "@/types/resume";
import { PreviewRow, PreviewSection } from "./PreviewSection";

interface Props {
  data: LanguageItem[];
}

export function PreviewLanguage({ data }: Props) {
  if (isEmptySection(data)) return null;
  const items = data.filter((l) => !isEmptySection(l));
  if (items.length === 0) return null;

  return (
    <PreviewSection title="어학">
      {items.map((l) => (
        <PreviewRow
          key={l.id}
          left={
            <div>
              <p className="text-body-sm text-text-primary">
                <span className="font-semibold">
                  {l.언어 ?? ""}
                </span>
                {l.시험명 && (
                  <span className="text-text-secondary">
                    {" · "}
                    {l.시험명}
                  </span>
                )}
                {l.점수등급 && (
                  <span className="text-text-secondary">
                    {" · "}
                    {l.점수등급}
                  </span>
                )}
              </p>
            </div>
          }
          right={l.취득년월 ?? ""}
        />
      ))}
    </PreviewSection>
  );
}
