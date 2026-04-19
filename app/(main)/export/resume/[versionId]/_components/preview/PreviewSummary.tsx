"use client";

import { PreviewSection } from "./PreviewSection";

interface Props {
  data: string | null;
}

export function PreviewSummary({ data }: Props) {
  if (!data || !data.trim()) return null;

  return (
    <PreviewSection title="자기소개">
      <p className="whitespace-pre-wrap text-body-sm text-text-primary leading-relaxed">
        {data}
      </p>
    </PreviewSection>
  );
}
